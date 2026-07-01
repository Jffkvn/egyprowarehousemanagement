"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { db, Notification } from '@/lib/db';
import { 
  LayoutDashboard, 
  Package, 
  History, 
  Settings as SettingsIcon, 
  PlusCircle, 
  LogOut, 
  Menu, 
  X, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  FileSpreadsheet,
  Bell
} from 'lucide-react';

interface ShellProps {
  children: React.ReactNode;
}

export default function Shell({ children }: ShellProps) {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const list = await db.getNotifications(user.id);
      setNotifications(list);
    } catch (err) {
      console.error('Error loading notifications:', err);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 12000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleMarkAllRead = async () => {
    if (!user) return;
    try {
      await db.markAllNotificationsAsRead(user.id);
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotifClick = async (notif: Notification) => {
    try {
      await db.markNotificationAsRead(notif.id);
      setNotifOpen(false);
      fetchNotifications();
      router.push(notif.link);
    } catch (err) {
      console.error(err);
    }
  };

  if (!user) return <>{children}</>;

  const roleLabels = {
    cfo: 'CFO',
    warehouse_manager: 'Warehouse Manager',
    pm: 'Project Manager'
  };

  const navItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      roles: ['pm', 'warehouse_manager', 'cfo']
    },
    {
      name: 'New Request',
      href: '/requests/new',
      icon: PlusCircle,
      roles: ['pm']
    },
    {
      name: 'Equipment Catalog',
      href: '/equipment',
      icon: Package,
      roles: ['pm', 'warehouse_manager', 'cfo']
    },
    {
      name: 'Procurement',
      href: '/procurement',
      icon: TrendingUp,
      roles: ['warehouse_manager', 'cfo']
    },
    {
      name: 'Audit Logs',
      href: '/transactions',
      icon: History,
      roles: ['warehouse_manager', 'cfo']
    },
    {
      name: 'Settings',
      href: '/settings',
      icon: SettingsIcon,
      roles: ['cfo']
    }
  ];

  const allowedNavItems = navItems.filter(item => item.roles.includes(user.role));

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Layout */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-surface border-r border-border transition-all duration-300
          ${sidebarCollapsed ? 'w-[70px]' : 'w-[240px]'}
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:relative'}
        `}
      >
        {/* Sidebar Header with Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          <div className="flex items-center space-x-3 overflow-hidden">
            <Image 
              src="/logo.png" 
              alt="Egypro Logo" 
              width={32} 
              height={32}
              className="flex-shrink-0"
            />
            {!sidebarCollapsed && (
              <span className="font-semibold text-navy text-sm tracking-wide truncate">
                Egypro EquipTrack
              </span>
            )}
          </div>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1 text-text-muted hover:text-text"
          >
            <X size={20} />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {allowedNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium
                  ${isActive 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-text hover:bg-background hover:text-navy'}
                `}
                title={sidebarCollapsed ? item.name : undefined}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Icon size={20} className={isActive ? 'text-primary' : 'text-text-muted'} />
                {!sidebarCollapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer with Logout & Collapse Toggle */}
        <div className="p-3 border-t border-border space-y-1 bg-surface">
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-md text-text hover:bg-danger/10 hover:text-danger text-sm font-medium transition-colors"
            title={sidebarCollapsed ? 'Logout' : undefined}
          >
            <LogOut size={20} className="text-text-muted hover:text-danger" />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
          
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:flex w-full items-center justify-center p-2 text-text-muted hover:text-navy rounded-md hover:bg-background transition-colors"
          >
            {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 flex items-center justify-between px-6 bg-surface border-b border-border z-30">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1 text-text-muted hover:text-text"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-lg font-semibold text-navy">
              {pathname === '/dashboard' && 'Dashboard'}
              {pathname === '/requests/new' && 'Submit Equipment Request'}
              {pathname.startsWith('/requests/') && pathname !== '/requests/new' && 'Request Details'}
              {pathname === '/equipment' && 'Equipment & Consumables Catalog'}
              {pathname === '/procurement' && 'Procurement Tracker'}
              {pathname === '/transactions' && 'Audit Transactions Log'}
              {pathname === '/settings' && 'System Settings'}
            </h1>
          </div>

          {/* User Details */}
          <div className="flex items-center space-x-4">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="p-1.5 rounded-full hover:bg-background text-text-muted hover:text-navy transition-colors relative focus:outline-none"
                title="Notifications"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-4 h-4 bg-danger text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setNotifOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 bg-surface border border-border rounded-lg shadow-lg z-50 overflow-hidden text-sm">
                    <div className="p-3 border-b border-border flex justify-between items-center bg-background/25">
                      <span className="font-bold text-navy text-xs">Notifications</span>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllRead}
                          className="text-[10px] text-primary hover:text-primary/80 font-semibold"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-border">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-xs text-text-muted italic">
                          No notifications
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => handleNotifClick(n)}
                            className={`p-3 cursor-pointer transition-colors text-xs space-y-1 hover:bg-background/40
                              ${!n.is_read ? 'bg-primary/5 border-l-2 border-primary' : 'pl-3.5'}
                            `}
                          >
                            <div className="flex justify-between items-start">
                              <span className="font-bold text-navy leading-tight">{n.title}</span>
                              <span className="text-[9px] text-text-muted shrink-0 ml-2">
                                {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-text-muted leading-snug">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-semibold text-text">{user.full_name}</span>
              <span className="text-xs text-text-muted">{user.email}</span>
            </div>
            
            {/* Role Badge */}
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border
              ${user.role === 'cfo' ? 'bg-danger/10 text-danger border-danger/20' : ''}
              ${user.role === 'warehouse_manager' ? 'bg-navy/10 text-navy border-navy/20' : ''}
              ${user.role === 'pm' ? 'bg-primary/10 text-primary border-primary/20' : ''}
            `}>
              {roleLabels[user.role]}
            </span>
          </div>
        </header>

        {/* Content Wrapper */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-[1200px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
