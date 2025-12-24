const placesApiKey = Deno.env.get("PLACES_API_KEY");
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DiscoverRequest {
  query: string;
  location?: {
    zip?: string;
    city?: string;
    lat?: number;
    lng?: number;
  };
  radiusKm?: number;
  minRating?: number;
  pageToken?: string;
}

interface NormalizedPlace {
  id: string;
  placeId: string;
  name: string;
  category?: string | null;
  rating?: number | null;
  website?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  potentialScore: number;
  notes?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  if (!placesApiKey) {
    return respondError("Places API key not configured", 500);
  }

  try {
    const body = (await req.json()) as DiscoverRequest;
    if (!body?.query) return respondError("Missing query", 400);

    // Determine center coordinates
    let lat = body.location?.lat;
    let lng = body.location?.lng;
    if ((!lat || !lng) && (body.location?.zip || body.location?.city)) {
      const geocode = await geocodeAddress(body.location?.zip || body.location?.city || "", placesApiKey);
      if (geocode) {
        lat = geocode.lat;
        lng = geocode.lng;
      }
    }

    const radiusKm = Math.min(Math.max(body.radiusKm ?? 15, 1), 50);

    const { results, nextPageToken } = await searchPlaces({
      query: body.query,
      lat,
      lng,
      radiusKm,
      minRating: body.minRating,
      pageToken: body.pageToken,
      apiKey: placesApiKey,
    });

    return new Response(
      JSON.stringify({ results, nextPageToken }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (err) {
    console.error("Discover error", err);
    return respondError("Internal error", 500);
  }
});

async function geocodeAddress(address: string, apiKey: string): Promise<{ lat: number; lng: number } | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await res.json();
  const loc = data?.results?.[0]?.geometry?.location;
  if (loc?.lat && loc?.lng) return { lat: loc.lat, lng: loc.lng };
  return null;
}

async function searchPlaces(params: {
  query: string;
  lat?: number;
  lng?: number;
  radiusKm: number;
  minRating?: number;
  pageToken?: string;
  apiKey: string;
}): Promise<{ results: NormalizedPlace[]; nextPageToken?: string }> {
  const endpoint = "https://places.googleapis.com/v1/places:searchText";
  const body: Record<string, unknown> = {
    textQuery: params.query,
    pageSize: 20,
  };

  if (params.pageToken) {
    body.pageToken = params.pageToken;
  }

  if (params.lat && params.lng) {
    body.locationBias = {
      circle: {
        center: {
          latitude: params.lat,
          longitude: params.lng,
        },
        radius: params.radiusKm * 1000,
      },
    };
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": params.apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.primaryType,places.primaryTypeDisplayName,places.types,places.rating,places.websiteUri,places.formattedAddress,places.location,nextPageToken",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places search failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  const places = (json.places || []) as any[];

  const normalized: NormalizedPlace[] = places
    .map((p) => {
      const rating = typeof p.rating === "number" ? p.rating : null;
      const website = p.websiteUri || null;
      const hasWebsite = !!website;
      const name: string = getText(p.displayName) || "";
      const category = getText(p.primaryTypeDisplayName) || p.primaryType || (p.types?.[0] ?? null);
      const address = p.formattedAddress || null;
      const lat = p.location?.latitude ?? null;
      const lng = p.location?.longitude ?? null;

      // Heuristic: "Need Score" — cheap signals only
      let potentialScore = 55;
      if (!hasWebsite) potentialScore += 25;
      if (rating !== null) {
        if (rating < 3) potentialScore += 18;
        else if (rating < 4) potentialScore += 10;
        else potentialScore -= 15;
      }
      const cat = (category || "").toLowerCase();
      if (/(roof|dent|spa|salon|hvac|plumb|garage|auto|home|clean|landscap|contractor|law|legal)/.test(cat)) {
        potentialScore += 5;
      }
      if (!address) potentialScore -= 5;
      potentialScore = Math.max(5, Math.min(100, potentialScore));

      return {
        id: p.id,
        placeId: p.id,
        name,
        category,
        rating,
        website,
        address,
        lat,
        lng,
        potentialScore,
        notes: !hasWebsite ? "No website detected." : null,
      };
    })
    .filter((p) => (params.minRating ? (p.rating || 0) >= params.minRating : true));

  return { results: normalized, nextPageToken: json.nextPageToken };
}

function respondError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function getText(val: any): string | null {
  if (!val) return null;
  if (typeof val === "string") return val;
  if (typeof val?.text === "string") return val.text;
  return null;
}