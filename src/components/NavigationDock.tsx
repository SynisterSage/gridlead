
import React from 'react';
import { 
  Search, 
  ListFilter, 
  Send, 
  BarChart3, 
  Settings as SettingsIcon,
  Bell
} from 'lucide-react';
import { AppView } from '../types';

interface NavigationDockProps {
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  onOpenNotifications?: () => void;
  unreadCount?: number;
}

const NavigationDock: React.FC<NavigationDockProps> = ({ activeView, setActiveView, onOpenNotifications, unreadCount = 0 }) => {
  const navItems = [
    { id: AppView.DASHBOARD, label: 'Stats', icon: BarChart3 },
    { id: AppView.DISCOVERY, label: 'Discovery', icon: Search },
    { id: AppView.QUEUE, label: 'Review', icon: ListFilter },
    { id: AppView.CAMPAIGNS, label: 'Outreach', icon: Send },
  ];

  return (
    <div className="fixed bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-fit">
      <div className="flex items-center gap-0.5 md:gap-1 p-1.5 md:p-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <nav className="flex items-center gap-0.5 md:gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`flex items-center justify-center md:justify-start gap-2 h-10 md:h-11 px-3 md:px-5 rounded-full transition-all duration-300 relative group ${
                  isActive 
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg' 
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Icon size={18} className="shrink-0" />
                <span className="text-[10px] md:text-xs font-bold whitespace-nowrap hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="h-5 md:h-6 w-px bg-slate-200 dark:bg-slate-800 mx-2 md:mx-3 opacity-60" />

        <div className="flex items-center gap-1 md:gap-2">
          <button 
            onClick={onOpenNotifications}
            className="relative h-10 w-10 md:h-11 md:w-11 flex items-center justify-center transition-all rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white active:scale-90"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center px-1 leading-none shadow-md">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

        <button 
          onClick={() => setActiveView(AppView.SETTINGS)}
          className={`h-10 w-10 md:h-11 md:w-11 flex items-center justify-center transition-all rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-90 ${
            activeView === AppView.SETTINGS ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800' : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <SettingsIcon size={18} />
        </button>
        </div>
      </div>
    </div>
  );
};

export default NavigationDock;
