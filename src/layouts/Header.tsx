import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, UserCircle, LogOut, Menu, History, BookOpen, Check, X, Loader2, Mail as MailIcon, Handshake } from 'lucide-react';
import { useCMS } from '../context/CMSContext';
import { useNavigate } from 'react-router-dom';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { NotificationModal } from '../components/ui/NotificationModal';

interface Notification {
  id: number;
  user_id: number;
  tenant_id: number | null;
  type: string;
  message: string;
  is_read: number;
  created_at: string;
}

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, setUser, setToken, settings, activeRole, activeTenantId } = useCMS();
  const navigate = useNavigate();
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isWarningOpen, setIsWarningOpen] = useState(false);

  // Notification state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [respondingId, setRespondingId] = useState<number | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const getHeaders = useCallback(() => {
    const t = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(t ? { Authorization: `Bearer ${t}` } : {})
    };
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/notifications`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('[Header] Failed to fetch notifications:', e);
    }
  }, [getHeaders]);

  // Poll notifications every 30 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Click-outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    if (isNotifOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isNotifOpen]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleRespond = async (notifId: number, action: 'accept' | 'reject') => {
    setRespondingId(notifId);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/notifications/respond`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ notification_id: notifId, action })
      });
      if (res.ok) {
        if (action === 'accept') {
          // If accepted, force a full page reload so the new workspace appears
          // and the user context updates seamlessly.
          window.location.reload();
        } else {
          await fetchNotifications();
        }
      } else {
        const data = await res.json();
        alert(data.error || 'Gagal merespon undangan.');
      }
    } catch (e) {
      console.error('[Header] Respond error:', e);
    } finally {
      setRespondingId(null);
    }
  };

  const handleMarkRead = async (notifId: number) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/notifications/${notifId}/read`, {
        method: 'PATCH',
        headers: getHeaders()
      });
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: 1 } : n));
    } catch (e) {
      console.error('[Header] Mark read error:', e);
    }
  };

  const handleLogout = () => {
    // Task 1: Total localStorage reset to prevent cross-session contamination
    localStorage.clear();
    setUser(null);
    setToken(null);
    window.location.href = '/login';
  };

  const formatTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} jam lalu`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} hari lalu`;
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  return (
    <header className="h-20 bg-[#09090b] border-b border-zinc-800/50 flex items-center justify-between px-4 md:px-8 sticky top-0 z-10 w-full shadow-sm">
      <div className="flex items-center gap-3 md:gap-6">
        {/* Mobile Menu Toggle */}
        <button 
          onClick={onMenuClick}
          className="p-2 -ml-2 text-zinc-300 md:hidden hover:bg-zinc-800 rounded-xl transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="flex-1 min-w-0 flex flex-col items-start leading-tight">
          <div className="flex items-center gap-2 w-full">
            <h1 className="text-xl font-black text-amber-400 tracking-tighter uppercase italic truncate" title={settings?.site_name || 'Uni-Inside'}>
              {settings?.site_name || 'Uni-Inside'}
            </h1>
            {(() => {
              // Role-based labeling: admin = owner workspace, others = guest/contributor workspace
              const isGuestWorkspace = activeRole && !['admin', 'super_admin'].includes(activeRole);
              return isGuestWorkspace ? (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-400 text-zinc-950 rounded-sm text-[9px] font-black uppercase tracking-widest whitespace-nowrap flex-shrink-0">
                  <Handshake className="w-3 h-3" />
                  TIM MITRA
                </span>
              ) : null;
            })()}
          </div>
          <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest pl-0.5">
            PANEL <span className="text-zinc-400">{(() => {
              // Role-based panel label
              if (!activeRole || activeRole === 'admin' || activeRole === 'super_admin') return 'ADMIN';
              return activeRole.replace(/_/g, ' ').toUpperCase();
            })()}</span>
          </span>
        </div>

      </div>

      <div className="flex items-center gap-4 md:gap-6">
          <button 
           onClick={() => {
              const url = settings?.global_options?.frontend_url;
              if (url) window.open(url, '_blank');
              else setIsWarningOpen(true);
           }}
            className="hidden md:flex px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-red-700 transition-colors shadow-sm items-center gap-2"
         >
           Buka Frontend
        </button>

        <div 
          onClick={() => navigate('/dashboard/updates')}
          className="flex items-center gap-2 cursor-pointer hover:bg-zinc-800 p-2 rounded-xl transition-colors border border-zinc-800/40 hover:border-zinc-700"
        >
          <History className="w-5 h-5 text-zinc-500" />
          <span className="hidden xl:block text-xs font-bold text-zinc-600 uppercase tracking-widest">Histori Update</span>
        </div>

        <button 
          onClick={() => window.open('https://drive.google.com/file/d/1ZaUlAvkTbGGBH8zTmLKxSJhAPoPO7ik7/view?usp=sharing', '_blank')}
          className="flex items-center gap-2 hover:bg-zinc-800 p-2 rounded-xl transition-colors border border-zinc-800/40 hover:border-zinc-700"
        >
          <BookOpen className="w-5 h-5 text-zinc-300" />
          <span className="hidden xl:block text-xs font-bold text-zinc-300 uppercase tracking-widest">Panduan</span>
        </button>

        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="relative p-2.5 text-zinc-300 hover:text-amber-400 transition-colors rounded-full hover:bg-zinc-800 border border-transparent"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-amber-400 rounded-full ring-2 ring-white animate-pulse" />
            )}
          </button>

          {/* Notification Dropdown */}
          {isNotifOpen && (
            <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Header */}
              <div className="px-5 py-4 bg-zinc-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">Notifikasi</h3>
                </div>
                {unreadCount > 0 && (
                  <span className="bg-amber-400 text-zinc-900 text-[10px] font-black px-2 py-0.5 rounded-full">
                    {unreadCount} baru
                  </span>
                )}
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <Bell className="w-8 h-8 text-zinc-200 mx-auto mb-3" />
                    <p className="text-sm text-zinc-400 font-medium">Tidak ada notifikasi.</p>
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div
                      key={notif.id}
                      className={`px-5 py-4 border-b border-zinc-100 last:border-b-0 transition-colors ${
                        !notif.is_read ? 'bg-amber-50/50' : 'bg-white hover:bg-zinc-50/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          notif.type === 'invitation' ? 'bg-amber-100 text-amber-600' : 'bg-zinc-100 text-zinc-500'
                        }`}>
                          <MailIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-xs font-black text-zinc-900 uppercase tracking-wider truncate">
                              {notif.type === 'invitation' ? 'Undangan Bergabung' : 'Notifikasi'}
                            </p>
                            {!notif.is_read && (
                              <span className="w-2 h-2 bg-amber-400 rounded-full flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-zinc-600 leading-relaxed mb-2">{notif.message}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-zinc-400 font-medium">{formatTimeAgo(notif.created_at)}</span>

                            {/* Invitation action buttons */}
                            {notif.type === 'invitation' && !notif.is_read && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleRespond(notif.id, 'accept')}
                                  disabled={respondingId === notif.id}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-amber-400 text-zinc-900 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-amber-500 transition-all disabled:opacity-50 shadow-sm"
                                >
                                  {respondingId === notif.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                  Terima
                                </button>
                                <button
                                  onClick={() => handleRespond(notif.id, 'reject')}
                                  disabled={respondingId === notif.id}
                                  className="flex items-center gap-1 px-3 py-1.5 border border-red-300 text-red-500 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-red-50 transition-all disabled:opacity-50"
                                >
                                  <X className="w-3 h-3" />
                                  Tolak
                                </button>
                              </div>
                            )}

                            {/* Mark as read for non-invitation unread */}
                            {notif.type !== 'invitation' && !notif.is_read && (
                              <button
                                onClick={() => handleMarkRead(notif.id)}
                                className="text-[10px] text-amber-600 font-bold hover:underline"
                              >
                                Tandai dibaca
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* View All Button */}
              <div className="p-3 bg-zinc-50 border-t border-zinc-100">
                <button
                  onClick={() => {
                    setIsNotifOpen(false);
                    navigate('/notifications');
                  }}
                  className="w-full py-2 bg-white border border-zinc-200 text-zinc-600 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-amber-400 hover:border-amber-400 hover:text-zinc-950 transition-all shadow-sm"
                >
                  Lihat Selengkapnya
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4 pl-6 border-l border-zinc-800/40">
          <div 
            className="text-right hidden sm:block cursor-pointer"
            onClick={() => navigate('/profile')}
          >
            <p className="text-sm font-bold text-white leading-none hover:text-amber-400 transition-colors">{user?.name || 'Admin User'}</p>
            <p className="text-[11px] text-zinc-300 font-medium mt-1 uppercase tracking-wider">{(() => {
              // Role-based role label in profile section
              if (!activeRole || activeRole === 'admin' || activeRole === 'super_admin') return 'ADMIN';
              return activeRole.replace(/_/g, ' ').toUpperCase();
            })()}</p>
          </div>
          <div 
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => navigate('/profile')}
          >
            <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-zinc-800/40 group-hover:border-amber-400 transition-all shadow-sm">
                {user?.profile_picture_url ? (
                    <img src={user.profile_picture_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                        <UserCircle className="w-8 h-8" />
                    </div>
                )}
            </div>
            <button onClick={(e) => { e.stopPropagation(); setIsLogoutConfirmOpen(true); }} className="p-2 text-zinc-400 hover:text-red-500 transition-colors" title="Keluar">
                <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      
      <ConfirmModal 
        isOpen={isLogoutConfirmOpen}
        title="Keluar"
        message="Apakah Anda yakin ingin keluar?"
        confirmLabel="Keluar"
        onConfirm={handleLogout}
        onClose={() => setIsLogoutConfirmOpen(false)}
      />

      <NotificationModal 
        isOpen={isWarningOpen}
        title="URL Belum Diatur"
        message="Frontend URL belum dikonfigurasi. Silakan atur di menu Pengaturan terlebih dahulu."
        type="warning"
        onClose={() => setIsWarningOpen(false)}
      />
    </header>
  );
}
