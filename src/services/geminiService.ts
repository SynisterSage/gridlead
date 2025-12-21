
import { GoogleGenAI, Type } from "@google/genai";

// Initialize the Google GenAI client with the provided API key from environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Mock Search Service for Discovery
const MOCK_BUSINESS_DATA = [
  { name: "Pietro's Pizza", category: "Restaurant", rating: 3.1, website: "pietrospizza.biz", potentialScore: 88, notes: "No SSL certificate and site isn't mobile-friendly." },
  { name: "Elite Roofing", category: "Construction", rating: 2.4, website: "eliteroofing-local.com", potentialScore: 94, notes: "Rating is very low; reviews mention poor communication." },
  { name: "Sunny Day Cafe", category: "Cafe", rating: 4.2, website: "", potentialScore: 75, notes: "No website detected. High potential for a landing page." },
  { name: "Apex Dental", category: "Health", rating: 3.5, website: "apex-dentistry.co", potentialScore: 62, notes: "Outdated design, last updated in 2018." },
  { name: "Downtown Gym", category: "Fitness", rating: 2.9, website: "dtgym.net", potentialScore: 81, notes: "Slow loading speeds (4s+). No booking system." },
  { name: "The Flower Nook", category: "Retail", rating: 4.8, website: "flowernook.com", potentialScore: 40, notes: "Strong site, but lacks local SEO optimization." },
  { name: "Quick Fix Auto", category: "Auto Repair", rating: 3.3, website: "", potentialScore: 89, notes: "Missing website. Relying entirely on FB page." },
  { name: "Smith & Sons Legal", category: "Legal", rating: 3.7, website: "smithlegal.com", potentialScore: 55, notes: "Clean site but very generic content." }
];

export const discoverLeadsAction = async (query: string, lat?: number, lng?: number, radius?: number) => {
  await new Promise(resolve => setTimeout(resolve, 1200));
  const lowercaseQuery = query.toLowerCase();
  const filtered = MOCK_BUSINESS_DATA.filter(b => 
    b.category.toLowerCase().includes(lowercaseQuery) || 
    b.name.toLowerCase().includes(lowercaseQuery) ||
    lowercaseQuery.length < 3
  );
  const results = filtered.length > 0 ? filtered : MOCK_BUSINESS_DATA.slice(0, 5);
  return [...results].sort((a, b) => (a.rating || 0) - (b.rating || 0));
};

/**
 * Generates a personalized outreach email for a lead using Gemini AI.
 * Follows @google/genai guidelines for JSON response and model configuration.
 */
export const generateOutreachEmail = async (lead: any) => {
  try {
    // Calling generateContent with the appropriate model and structured JSON configuration.
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a friendly, professional web design consultant.
Write a short, personalized outreach email (subject + body) for a business.
Business: ${lead.name}
Category: ${lead.category}
Website: ${lead.website || 'None'}
Context/Weaknesses: ${lead.notes}
Design Score: ${lead.score.design}%
Performance Score: ${lead.score.performance}%

Guidelines:
- Keep it under 100 words.
- Be helpful, not pushy.
- Mention one specific weakness from the context.
- End with a simple question about their goals.`,
      config: {
        responseMimeType: "application/json",
        // Using responseSchema to ensure structured and reliable JSON output from the model.
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: {
              type: Type.STRING,
              description: "A compelling subject line for the outreach email."
            },
            body: {
              type: Type.STRING,
              description: "The personalized body of the email."
            }
          },
          required: ["subject", "body"]
        }
      }
    });

    // Accessing the generated text directly from the text property.
    const jsonStr = response.text?.trim() || "{}";
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Outreach generation failed:", error);
    // Graceful fallback in case of API errors.
    return {
      subject: `Improving ${lead.name}'s digital presence`,
      body: `Hi there,\n\nI was looking at ${lead.name} today and noticed some areas where your website could perform better, particularly regarding its mobile responsiveness. Would you be open to a quick chat about how to improve this?\n\nBest regards.`
    };
  }
};
