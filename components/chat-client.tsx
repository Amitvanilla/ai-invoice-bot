"use client";
import { useEffect, useRef, useState } from "react";
import { Message, ChatSession } from "@prisma/client";
import { Plus, MessageSquare, Trash2, MoreHorizontal, LogOut, Search, BookOpen, User, Mic, MicOff, Bot, Upload, FileText, Download, Eye } from "lucide-react";
import dynamic from 'next/dynamic';

const PDFViewerModal = dynamic(() => import('./pdf-viewer-modal'), {
  ssr: false,
  loading: () => null
});
import { useSession, signIn, signOut } from "next-auth/react";

export default function ChatClient({ initialChats }:{ initialChats: (ChatSession & {messages: Message[]})[]}){
  const [chats, setChats] = useState(initialChats);
  const [active, setActive] = useState(initialChats[0]?.id || "");
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();

  // Invoice and Integration related state
  const [activeTab, setActiveTab] = useState<'chat' | 'invoices' | 'integrations' | 'dashboard'>('chat');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<any>(null);

  // Dashboard state
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // PDF Viewer Modal state
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFilename, setPdfFilename] = useState('');

  // Load dashboard data
  const loadDashboardData = async () => {
    if (dashboardData) return; // Don't reload if already loaded

    setLoadingDashboard(true);
    try {
      const response = await fetch('/api/dashboard');
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      } else {
        console.error('Failed to load dashboard data');
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoadingDashboard(false);
    }
  };

  const current = chats.find(c=>c.id===active) || chats[0];

  // Gmail sync function with AI parsing integration
  const syncGmailInvoices = async () => {
    setSyncInProgress(true);
    try {
      // First, get Gmail emails
      const gmailResponse = await fetch('/api/integrations/gmail/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!gmailResponse.ok) {
        const error = await gmailResponse.json();
        throw new Error(error.error || 'Failed to sync Gmail');
      }

      const gmailResult = await gmailResponse.json();
      console.log('Gmail sync result:', gmailResult);

      // TODO: Send invoice attachments to AI parsing service
      setLastSyncResult(gmailResult.data);
      alert(`Found ${gmailResult.data.totalEmails} emails with ${gmailResult.data.processedEmails} potential invoices!`);

      // Future integration:
      // 1. Extract invoice attachments from Gmail
      // 2. Send to invoice-service AI pipeline
      // 3. Store processed results in database
      // 4. Update UI with processed invoice data

    } catch (error) {
      console.error('Sync error:', error);
      alert(`Sync failed: ${error.message}`);
    } finally {
      setSyncInProgress(false);
    }
  };

  // Filter chats based on search query
  const filteredChats = searchQuery
    ? chats.filter(chat =>
        chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.messages.some(message =>
          message.content.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : chats;

  // Highlight matching text
  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 text-gray-900 px-0.5 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  // Generate chat title from first user message
  const generateChatTitle = (message: string) => {
    const cleanMessage = message.trim();
    if (cleanMessage.length <= 30) {
      return cleanMessage;
    }
    return cleanMessage.substring(0, 30) + "...";
  };

  // Handle session changes
  useEffect(() => {
    if (session === null) {
      // Session expired or user logged out
      window.location.href = '/login';
    }
  }, [session]);

  useEffect(()=>{
    if (!active && chats[0]) setActive(chats[0].id);
  },[active,chats]);

  // Load invoices when switching to invoices tab
  useEffect(() => {
    if (activeTab === 'invoices') {
      fetchInvoices();
    }
  }, [activeTab]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [current?.messages]);

  // Close menus when clicking outside and handle keyboard shortcuts
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;

      // Don't close if clicking on the profile button or its children
      if (target.closest('[data-profile-button]')) {
        return;
      }

      // Don't close if clicking on the three dots button or its children
      if (target.closest('[data-menu-button]')) {
        return;
      }

      setShowUserMenu(false);
      setOpenMenuId(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+K or Cmd+K to focus search input
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        const searchInput = document.querySelector('input[placeholder="Search conversations..."]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }

      // Escape to clear search
      if (event.key === 'Escape') {
        const activeElement = document.activeElement as HTMLElement;
        const searchInput = document.querySelector('input[placeholder="Search conversations..."]') as HTMLInputElement;
        if (activeElement === searchInput) {
          setSearchQuery("");
        }
      }
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  async function send(){
    if (!input.trim() || isStreaming) return;

    setIsStreaming(true);

    // optimistic user message
    const localId = crypto.randomUUID();
    const userMessage = input.trim();
    setChats(cs=> cs.map(c=> c.id===current?.id ? {
      ...c,
      messages:[...c.messages, {id: localId, role:"user", content: userMessage, chatId:c.id, createdAt: new Date() as any} as any],
      // Update title if this is the first message
      title: c.messages.length === 0 ? generateChatTitle(userMessage) : c.title
    } : c));

    // Add streaming assistant message placeholder with loading state
    const streamId = crypto.randomUUID();
    setChats(cs=> cs.map(c=> c.id===current?.id ? {...c, messages:[...c.messages, {id: streamId, role:"assistant", content: "", chatId:c.id, createdAt: new Date() as any, isStreaming: true} as any]} : c));

    const prompt = input;
    setInput("");

    try {
      // Create SSE connection with POST request
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          chatId: current?.id
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Read the SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)); // Remove 'data: ' prefix

              if (data.event === 'chunk') {
                assistantContent += data.content;
                setChats(cs=> cs.map(c=> c.id===current?.id ? {
                  ...c,
                  messages: c.messages.map(m=> m.id===streamId ? {...m, content: assistantContent, isStreaming: false} : m)
                } : c));
              } else if (data.event === 'done') {
                // Update with final message from database
                setChats(cs=> cs.map(c=> c.id===current?.id ? {
                  ...c,
                  messages: c.messages.map(m=> m.id===streamId ? {...m, content: data.fullText, id: data.messageId || streamId} : m)
                } : c));
                setIsStreaming(false);
                return;
              } else if (data.event === 'error') {
                console.error('SSE Error:', data.error);
                setChats(cs=> cs.map(c=> c.id===current?.id ? {
                  ...c,
                  messages: c.messages.map(m=> m.id===streamId ? {...m, content: "Error: " + data.error} : m)
                } : c));
                setIsStreaming(false);
                return;
              }
            } catch (error) {
              console.error('Error parsing SSE data:', error, 'Line:', line);
            }
          }
        }
      }

    } catch (error) {
      console.error('Error creating SSE connection:', error);
      setChats(cs=> cs.map(c=> c.id===current?.id ? {
        ...c,
        messages: c.messages.map(m=> m.id===streamId ? {...m, content: "Failed to start chat"} : m)
      } : c));
      setIsStreaming(false);
    }
  }

  async function newChat(){
    const newChatId = crypto.randomUUID();
    const newChatData = {
      id: newChatId,
      title: "New chat",
      userId: "local",
      createdAt: new Date() as any,
      updatedAt: new Date() as any,
      messages: []
    };
    setChats(cs=> [newChatData, ...cs]);
    setActive(newChatId);
    // Clear search when creating new chat
    setSearchQuery("");
  }

  async function deleteChat(chatId: string){
    if (chats.length <= 1) return; // Don't delete if it's the last chat

    setDeletingChatId(chatId);

    try {
      // Delete from database
      const response = await fetch(`/api/chats/${chatId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        console.error('Failed to delete chat from database');
        setDeletingChatId(null);
        return;
      }

      // Update local state
      setChats(cs=> cs.filter(c=> c.id !== chatId));

      // If we're deleting the active chat, switch to the first remaining chat
      if (active === chatId) {
        const remainingChats = chats.filter(c=> c.id !== chatId);
        setActive(remainingChats[0]?.id || "");
      }

      setDeletingChatId(null);
    } catch (error) {
      console.error('Error deleting chat:', error);
      setDeletingChatId(null);
    }
  }

  // Invoice handling functions
  const uploadInvoice = async (file: File) => {
    setUploadingInvoice(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/invoices/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Upload failed');
      }

      const result = await response.json();
      setInvoices(prev => [result, ...prev]);
      return result;
    } catch (error) {
      console.error('Invoice upload failed:', error);
      // Show specific error message for encrypted PDFs
      if (error.message?.includes('encrypted') || error.message?.includes('password')) {
        alert('❌ PDF Upload Failed\n\nThe uploaded PDF file is password-protected or encrypted.\n\nPlease:\n1. Remove the password from the PDF\n2. Save it as an unprotected PDF\n3. Try uploading again');
      } else {
        alert(`❌ Upload Failed: ${error.message}`);
      }
      throw error;
    } finally {
      setUploadingInvoice(false);
    }
  };

  const fetchInvoices = async () => {
    setLoadingInvoices(true);
    try {
      console.log('Fetching invoices...');
      const response = await fetch('/api/invoices');

      console.log('Invoice API response status:', response.status);

      if (response.status === 401) {
        console.error('Authentication required for invoices');
        alert('Please log in to view your invoices');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        console.log('Fetched invoices:', data.length);
        setInvoices(data);
      } else {
        const errorData = await response.json();
        console.error('Invoice fetch error:', errorData);
        alert(`Failed to load invoices: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
      alert('Failed to load invoices. Please check your connection.');
    } finally {
      setLoadingInvoices(false);
    }
  };

  const searchInvoices = async (query: string) => {
    try {
      const response = await fetch(`/api/invoices/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setInvoices(data);
      }
    } catch (error) {
      console.error('Invoice search failed:', error);
    }
  };

  const exportInvoice = async (invoiceId: string) => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/export`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        window.open(data.export_url, '_blank');
      }
    } catch (error) {
      console.error('Invoice export failed:', error);
    }
  };

  const viewOriginalPDF = async (invoiceId: string) => {
    try {
      console.log('Viewing PDF for invoice:', invoiceId);
      console.log('Current session:', session);

      if (!session) {
        alert('Please log in to view PDFs');
        return;
      }

      // Find the invoice to get filename
      const invoice = invoices.find(inv => inv.id === invoiceId);
      const filename = invoice?.filename || `invoice_${invoiceId}.pdf`;

      console.log('Found invoice:', invoice);
      console.log('PDF filename:', filename);

      // Set PDF URL and open modal
      const pdfUrl = `/api/invoices/${invoiceId}/download?type=original`;
      console.log('PDF URL:', pdfUrl);

      setPdfUrl(pdfUrl);
      setPdfFilename(filename);
      setPdfModalOpen(true);

      console.log('PDF modal opened for:', filename);
    } catch (error) {
      console.error('PDF view failed:', error);
      alert('Failed to open PDF viewer. Please check the console for details.');
    }
  };

  const downloadProcessedExcel = async (invoiceId: string) => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/download?type=processed`);
      if (!response.ok) {
        alert('Download failed');
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice_analysis_${invoiceId}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Excel download failed');
    }
  };

  return (
    <div className="flex h-screen bg-white overflow-x-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-gray-50 text-gray-800 flex flex-col transition-all duration-300 ease-in-out relative border-r border-gray-200`}>
        {/* Logo and Collapse/Expand Button */}
        <div className="px-4 py-3 flex justify-between items-center">
          {/* Logo */}
          <div className={`flex items-center ${sidebarCollapsed ? 'hidden' : ''}`}>
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <span className="text-lg font-semibold text-gray-900">Amit Chat</span>
          </div>

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors duration-200"
          >
            <svg
              className={`w-3.5 h-3.5 text-gray-500 transform transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Top Actions */}
        <div className="p-4 space-y-3">
          <button
            onClick={newChat}
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-3' : 'gap-2.5 px-3 py-2.5'} text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 text-base font-medium border border-gray-200 hover:border-gray-300`}
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            {!sidebarCollapsed && <span>New chat</span>}
          </button>
          
          {/* Persistent Search Input */}
          {!sidebarCollapsed && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 bg-white text-gray-800 placeholder-gray-500 transition-all duration-200"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-400 transition-colors duration-200"
                >
                  ×
                </button>
              )}
            </div>
          )}
          
          {/* <button className="w-full flex items-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm">
            <BookOpen className="w-4 h-4" />
            Library
          </button> */}
        </div>

        {/* Chat List */}
        <div className={`flex-1 overflow-y-auto ${sidebarCollapsed ? 'px-2' : 'px-4'} py-2`}>
          <div className="space-y-1">
            {filteredChats.length === 0 && searchQuery && !sidebarCollapsed ? (
              <div className="px-3 py-4 text-center text-gray-400 text-sm">
                No conversations found matching "{searchQuery}"
              </div>
            ) : (
              filteredChats.map(c=> (
              <div key={c.id} className="relative group">
                <button
                  onClick={()=>setActive(c.id)}
                  disabled={deletingChatId === c.id}
                  className={`w-full ${sidebarCollapsed ? 'px-2 py-3 justify-center' : 'text-left px-3 py-2.5'} rounded-lg transition-all duration-200 hover:bg-gray-100 ${
                    c.id===current?.id
                      ? "bg-gray-100 border border-gray-200"
                      : ""
                  } ${deletingChatId === c.id ? 'opacity-50 cursor-not-allowed' : ''} flex items-center`}
                >
                  {!sidebarCollapsed && (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-base text-gray-900">
                          {searchQuery ? highlightText(c.title, searchQuery) : c.title}
                        </div>
                      </div>
                      {deletingChatId === c.id ? (
                        <div className="p-1 flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      ) : (
                        <button
                          data-menu-button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === c.id ? null : c.id);
                          }}
                                                      className="opacity-100 p-1 hover:bg-gray-100 rounded transition-all duration-200"
                        >
                          <MoreHorizontal className="w-4 h-4 text-gray-400" />
                        </button>
                      )}
                    </div>
                  )}
                  {sidebarCollapsed && (
                    <div className="flex items-center justify-center w-full">
                      {deletingChatId === c.id ? (
                        <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                          <span className="text-white text-xs font-medium">
                            {c.title.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </button>
                
                {/* Chat Menu Dropdown */}
                {openMenuId === c.id && (
                  <div className={`absolute z-50 bg-white border border-gray-100 rounded-xl shadow-lg py-2 min-w-[120px] ${
                    sidebarCollapsed ? 'left-16 top-0' : 'right-2 top-8'
                  }`}>
                    {filteredChats.length > 1 && (
                      <button
                        onClick={() => {
                          deleteChat(c.id);
                          setOpenMenuId(null);
                        }}
                        disabled={deletingChatId === c.id}
                        className={`w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-gray-100 rounded-xl transition-all duration-200 flex items-center gap-2 ${
                          deletingChatId === c.id ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
              ))
            )}
          </div>
        </div>

        {/* User Profile Section */}
        <div className={`${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
          <div className="relative">
            <button
              data-profile-button
              onClick={(e) => {
                e.stopPropagation();
                setShowUserMenu(!showUserMenu);
              }}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-3 py-2.5'} hover:bg-gray-100 rounded-lg transition-all duration-200 border border-gray-200 hover:border-gray-300`}
            >
              {session?.user?.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || 'User'}
                  className={`${sidebarCollapsed ? 'w-6 h-6' : 'w-8 h-8'} rounded-full flex-shrink-0 object-cover`}
                />
              ) : (
                <div className={`${sidebarCollapsed ? 'w-6 h-6' : 'w-8 h-8'} bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0`}>
                  <span className={`${sidebarCollapsed ? 'text-xs' : 'text-sm'} text-white font-medium`}>
                    {session?.user?.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
              )}
              {!sidebarCollapsed && (
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {session?.user?.name || 'User'}
                  </div>
                  <div className="text-xs text-gray-700">Free</div>
                </div>
              )}
            </button>

            {/* User Menu Dropdown */}
            {showUserMenu && (
              <div className={`absolute bottom-full mb-2 z-50 bg-white border border-gray-100 rounded-xl shadow-lg py-2 ${
                sidebarCollapsed ? 'left-0 right-0 w-48 mx-auto' : 'left-0 right-0'
              }`}>
                {!sidebarCollapsed && (
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      {session?.user?.image ? (
                        <img
                          src={session.user.image}
                          alt={session.user.name || 'User'}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-sm text-white font-medium">
                            {session?.user?.email?.charAt(0).toUpperCase() || 'U'}
                          </span>
                        </div>
                      )}
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {session?.user?.email}
                      </div>
                    </div>
                  </div>
                )}
                <button
                  onClick={async () => {
                    try {
                      await signOut({ callbackUrl: '/login' });
                      // Force a page reload to clear any cached state
                      window.location.href = '/login';
                    } catch (error) {
                      console.error('Logout error:', error);
                      // Fallback: force redirect
                      window.location.href = '/login';
                    }
                  }}
                  className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-gray-100 rounded-b-xl transition-all duration-200 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  {!sidebarCollapsed && <span>Log out</span>}
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-white overflow-x-hidden">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 bg-white">
          <div className="px-6 py-3">
            <div className="flex space-x-8">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex items-center gap-2 px-1 py-2 border-b-2 font-medium text-sm ${
                  activeTab === 'chat'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                {!sidebarCollapsed && 'Chat'}
              </button>
              <button
                onClick={() => setActiveTab('invoices')}
                className={`flex items-center gap-2 px-1 py-2 border-b-2 font-medium text-sm ${
                  activeTab === 'invoices'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <FileText className="w-4 h-4" />
                {!sidebarCollapsed && 'Invoices'}
              </button>
              <button
                onClick={() => setActiveTab('integrations')}
                className={`flex items-center gap-2 px-1 py-2 border-b-2 font-medium text-sm ${
                  activeTab === 'integrations'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Upload className="w-4 h-4" />
                {!sidebarCollapsed && 'Integrations'}
              </button>
              <button
                onClick={() => {
                  setActiveTab('dashboard');
                  loadDashboardData();
                }}
                className={`flex items-center gap-2 px-1 py-2 border-b-2 font-medium text-sm ${
                  activeTab === 'dashboard'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                {!sidebarCollapsed && 'Dashboard'}
              </button>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'chat' && (
          <>
            {/* Chat Header */}
            <div className="border-b border-gray-200 px-6 py-3 bg-white">
              <h1 className="text-xl font-semibold text-gray-900">
                {current?.title || "Select a chat"}
              </h1>
            </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-32 py-24 space-y-4 bg-white">
          {!current ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">Welcome to Amit Chat</h3>
                <p className="text-base text-gray-500">Select a chat from the sidebar or start a new conversation</p>
              </div>
            </div>
          ) : current.messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">Start your conversation</h3>
                <p className="text-base text-gray-500">Send a message to begin chatting</p>
              </div>
            </div>
          ) : (
            current.messages.map(m=> (
              <div key={m.id} className={`flex ${m.role==="user"?"justify-end":"justify-start"} mb-4`}>
                <div className={`px-3 py-2 rounded-2xl ${
                  m.role==="user"
                    ? "max-w-2xl bg-gray-100 text-gray-900 rounded-br-md"
                    : "w-full text-gray-900 rounded-bl-md"
                }`}>
                  <div className="whitespace-pre-wrap break-words text-base leading-relaxed">
                    {(m as any).isStreaming && !m.content ? (
                      <div className="flex items-center space-x-1">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                        </div>
                      </div>
                    ) : (
                      m.content
                    )}
                  </div>
                  <div className={`text-sm mt-2 opacity-90 ${
                    m.role==="user" ? "text-gray-800" : "text-gray-700"
                  }`}>
                    {new Date(m.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                </div>
              </div>
            ))
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 bg-white px-6 py-4">
          <form onSubmit={(e)=>{e.preventDefault(); send();}} className="flex gap-2 max-w-4xl mx-auto">
            <div className="flex-1 relative flex items-center bg-gray-100 rounded-3xl px-4 py-3 border border-gray-200 focus-within:border-gray-300">
              <input
                value={input}
                onChange={e=>setInput(e.target.value)}
                placeholder="Message ChatGPT..."
                disabled={isStreaming}
                className="flex-1 bg-transparent text-base focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed resize-none text-gray-900 placeholder-gray-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              
              {/* Microphone Button */}
              <button
                type="button"
                onClick={() => setIsRecording(!isRecording)}
                disabled={isStreaming}
                className={`p-1.5 rounded-full transition-all duration-200 ml-2 ${
                  isRecording
                    ? 'bg-red-100 text-red-600'
                    : 'hover:bg-gray-200 text-gray-500'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isRecording ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>

              {/* Send Button */}
              <button
                type="submit"
                disabled={isStreaming || !input.trim()}
                className={`p-1.5 rounded-full transition-all duration-200 ml-1 ${
                  input.trim() && !isStreaming
                    ? 'bg-black text-white hover:bg-gray-800'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isStreaming ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
                  </svg>
                )}
              </button>
            </div>
          </form>
          {/* <p className="text-xs text-gray-400 mt-2 text-center max-w-4xl mx-auto">
            Press Enter to send, Shift + Enter for new line
          </p> */}
        </div>
        </>
        )}

        {activeTab === 'invoices' && (
          /* Invoice Management Tab */
          <div className="flex-1 flex flex-col">
            {/* Invoice Header - Matching Chat Window Style */}
            <div className="border-b border-gray-200 bg-white">
              <div className="px-6 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <h1 className="text-lg font-semibold text-gray-900">Invoice Management</h1>
                  </div>
                  <div className="flex items-center gap-4">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search invoices..."
                      value={invoiceSearchQuery}
                      onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  {/* Upload Button */}
                  <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
                    <Upload className="w-4 h-4" />
                    Upload Invoice
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            await uploadInvoice(file);
                            fetchInvoices(); // Refresh the list
                          } catch (error) {
                            alert('Upload failed: ' + error.message);
                          }
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Invoice Table */}
            <div className="flex-1 overflow-x-hidden overflow-y-auto px-6 py-4">
              <div className="bg-white rounded-lg border border-gray-200 w-full">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-medium text-gray-900">Processed Invoices</h2>
                  <p className="text-sm text-gray-500">Manage and search through your uploaded invoices</p>
                </div>

                <div className="overflow-x-auto w-full">
                  <table className="w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/2">
                          Filename
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                          Upload Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {uploadingInvoice && (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                              Processing invoice...
                            </div>
                          </td>
                        </tr>
                      )}
                      {loadingInvoices ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                            Loading invoices...
                          </td>
                        </tr>
                      ) : invoices.length === 0 && !uploadingInvoice ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                            <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                            No invoices uploaded yet
                          </td>
                        </tr>
                      ) : (
                        invoices.map((invoice) => (
                          <tr key={invoice.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 w-1/2">
                              <div className="flex items-center">
                                <FileText className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <button
                                    onClick={() => viewOriginalPDF(invoice.id)}
                                    className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline text-left block truncate"
                                    title={invoice.filename}
                                  >
                                    {invoice.filename}
                                  </button>
                                  <div className="text-sm text-gray-500 truncate">
                                    {invoice.extracted_data?.invoice_number || (invoice.status === 'processing' ? 'Processing...' : 'N/A')}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 w-1/6">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                invoice.status === 'processed'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4 w-1/4 text-sm text-gray-500">
                              {new Date(invoice.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 w-1/6 text-sm font-medium">
                              <div className="flex items-center gap-2 justify-center">
                                <button
                                  onClick={() => viewOriginalPDF(invoice.id)}
                                  className="text-blue-600 hover:text-blue-900 p-1"
                                  title="View Original PDF Document"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => downloadProcessedExcel(invoice.id)}
                                  className="text-green-600 hover:text-green-900 p-1"
                                  title="Download Excel (Analysis Report)"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Invoice Details Modal */}
            {selectedInvoice && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto overflow-x-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900">
                        Invoice Details: {selectedInvoice.filename}
                      </h3>
                      <button
                        onClick={() => setSelectedInvoice(null)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div className="px-6 py-4">
                    {/* Invoice Summary */}
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Invoice Summary</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs font-medium text-gray-500">Invoice Number:</span>
                            <p className="text-sm text-gray-900">{selectedInvoice.extracted_data?.invoice_number || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-500">Vendor:</span>
                            <p className="text-sm text-gray-900">{selectedInvoice.extracted_data?.vendor_name || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-500">Date:</span>
                            <p className="text-sm text-gray-900">{selectedInvoice.extracted_data?.date || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs font-medium text-gray-500">Total Amount:</span>
                            <p className="text-sm font-semibold text-gray-900">{selectedInvoice.extracted_data?.total_amount || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-500">Status:</span>
                            <p className="text-sm text-gray-900">{selectedInvoice.status}</p>
                          </div>
                          {selectedInvoice.extracted_data?.passenger_name && (
                            <div>
                              <span className="text-xs font-medium text-gray-500">Passenger:</span>
                              <p className="text-sm text-gray-900">{selectedInvoice.extracted_data.passenger_name}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* File Actions */}
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Actions</h4>
                      <div className="flex space-x-3">
                        {selectedInvoice.extracted_data?.original_file_path && (
                          <a
                            href={selectedInvoice.extracted_data.original_file_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            👁️ View Original PDF
                          </a>
                        )}
                        {selectedInvoice.extracted_data?.processed_file_path && (
                          <a
                            href={selectedInvoice.extracted_data.processed_file_path}
                            download
                            className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            📊 Download Excel Report
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Additional Details */}
                    {selectedInvoice.extracted_data?.line_items && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Line Items</h4>
                        <div className="space-y-1">
                          {selectedInvoice.extracted_data.line_items.map((item: any, index: number) => (
                            <div key={index} className="flex justify-between text-sm">
                              <span className="text-gray-600">{item.description}</span>
                              <span className="font-medium text-gray-900">{item.amount}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedInvoice.extracted_data?.taxes && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Taxes</h4>
                        <div className="space-y-1">
                          {selectedInvoice.extracted_data.taxes.map((tax: any, index: number) => (
                            <div key={index} className="flex justify-between text-sm">
                              <span className="text-gray-600">{tax.type} ({tax.rate})</span>
                              <span className="font-medium text-gray-900">{tax.amount}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          </div>
        )}

        {/* PDF Viewer Modal */}
        <PDFViewerModal
          isOpen={pdfModalOpen}
          onClose={() => setPdfModalOpen(false)}
          pdfUrl={pdfUrl}
          filename={pdfFilename}
          onDownload={() => {
            if (pdfUrl) {
              const link = document.createElement('a');
              link.href = pdfUrl;
              link.download = pdfFilename;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }
          }}
        />

        {activeTab === 'integrations' && (
          /* Integrations Tab */
          <div className="flex-1 flex flex-col">
            {/* Integration Header - Matching Chat Window Style */}
            <div className="border-b border-gray-200 bg-white">
              <div className="px-6 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <h1 className="text-lg font-semibold text-gray-900">Integrations</h1>
                  </div>
                  <div className="text-sm text-gray-500">
                    Connect your accounts to automatically sync invoices
                  </div>
                </div>
              </div>
            </div>

            {/* Integration Content */}
            <div className="flex-1 overflow-y-auto px-6 py-8">
              <div className="max-w-4xl mx-auto space-y-8">

                {/* Gmail Integration Card */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Gmail Integration</h3>
                        <p className="text-sm text-gray-600">
                          Automatically sync invoices from your Gmail account
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {gmailConnected ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                          Connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                          Not Connected
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">Auto-sync Invoices</h4>
                        <p className="text-xs text-gray-600">
                          Automatically detect and process invoice emails
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={syncEnabled}
                          onChange={(e) => setSyncEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center gap-3">
                      {gmailConnected ? (
                        <button
                          onClick={() => setGmailConnected(false)}
                          className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
                        >
                          Disconnect Gmail
                        </button>
                      ) : (
                        <button
                          onClick={() => signIn("google", { callbackUrl: window.location.href })}
                          className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700"
                        >
                          Connect Gmail
                        </button>
                      )}

                      <button
                        onClick={syncGmailInvoices}
                        disabled={!gmailConnected || syncInProgress}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {syncInProgress ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Syncing...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            Sync Invoices
                          </>
                        )}
                      </button>

                      <button
                        className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100"
                        disabled={!gmailConnected}
                      >
                        Configure Filters
                      </button>
                    </div>

                    {gmailConnected && (
                      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start gap-3">
                          <div className="w-5 h-5 text-blue-600 mt-0.5">
                            <svg fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-blue-900">Gmail Connected Successfully</h4>
                            <p className="text-xs text-blue-700 mt-1">
                              Your Gmail account is now connected. The system will automatically scan for invoice emails and process them.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {lastSyncResult && (
                      <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-start gap-3">
                          <div className="w-5 h-5 text-green-600 mt-0.5">
                            <svg fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-green-900">Last Sync Results</h4>
                            <p className="text-xs text-green-700 mt-1">
                              Found {lastSyncResult.totalEmails} emails, processed {lastSyncResult.processedEmails} potential invoices
                            </p>
                            {lastSyncResult.results && lastSyncResult.results.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {lastSyncResult.results.slice(0, 3).map((email: any, index: number) => (
                                  <div key={index} className="text-xs text-green-800 bg-green-100 px-2 py-1 rounded">
                                    {email.subject || 'No subject'}
                                  </div>
                                ))}
                                {lastSyncResult.results.length > 3 && (
                                  <div className="text-xs text-green-600">
                                    ... and {lastSyncResult.results.length - 3} more emails
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Future Integrations Placeholder */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Coming Soon</h3>
                        <p className="text-sm text-gray-600">
                          Outlook, QuickBooks, Xero, and more integrations
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="text-sm text-gray-500">
                      We're working on additional integrations to make invoice management even easier.
                      Stay tuned for updates!
                    </div>
                  </div>
                </div>

                {/* Integration Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                        <FileText className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Invoices Synced</p>
                        <p className="text-2xl font-semibold text-gray-900">0</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Processing Queue</p>
                        <p className="text-2xl font-semibold text-gray-900">0</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-yellow-50 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Failed Syncs</p>
                        <p className="text-2xl font-semibold text-gray-900">0</p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          /* Dashboard Tab */
          <div className="flex-1 flex flex-col">
            {/* Dashboard Header - Matching Chat Window Style */}
            <div className="border-b border-gray-200 bg-white">
              <div className="px-6 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <h1 className="text-lg font-semibold text-gray-900">Expense Dashboard</h1>
                  </div>
                  <div className="text-sm text-gray-500">
                    Track your invoice spending and vendor analytics
                  </div>
                </div>
              </div>
            </div>

            {/* Dashboard Content */}
            <div className="flex-1 overflow-x-hidden overflow-y-auto px-6 py-8">
              {loadingDashboard ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-gray-500">Loading dashboard data...</div>
                </div>
              ) : dashboardData ? (
                <div className="max-w-7xl mx-auto space-y-8 w-full">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                          <FileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Total Invoices</p>
                          <p className="text-2xl font-semibold text-gray-900">{dashboardData.summary?.totalInvoices || 0}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                          </svg>
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Total Spend</p>
                          <p className="text-2xl font-semibold text-gray-900">₹{dashboardData.summary?.totalSpend?.toLocaleString() || '0'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Avg Invoice Value</p>
                          <p className="text-2xl font-semibold text-gray-900">₹{dashboardData.summary?.averageInvoiceValue?.toLocaleString() || '0'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Top Vendor</p>
                          <p className="text-sm font-semibold text-gray-900 truncate" title={dashboardData.summary?.topVendor || 'N/A'}>
                            {dashboardData.summary?.topVendor || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500">₹{dashboardData.summary?.topVendorSpend?.toLocaleString() || '0'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Top Vendors Chart */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Vendors by Spend</h3>
                      <div className="space-y-4">
                        {dashboardData.topVendors?.slice(0, 5).map((vendor: any, index: number) => (
                          <div key={vendor.vendor} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                                {index + 1}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{vendor.vendor}</p>
                                <p className="text-xs text-gray-500">{vendor.invoiceCount} invoices</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-gray-900">₹{vendor.totalSpend.toLocaleString()}</p>
                            </div>
                          </div>
                        )) || (
                          <p className="text-gray-500 text-center py-4">No vendor data available</p>
                        )}
                      </div>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Invoices</h3>
                      <div className="space-y-3">
                        {dashboardData.recentInvoices?.map((invoice: any) => (
                          <div key={invoice.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{invoice.vendor}</p>
                              <p className="text-xs text-gray-500">
                                {invoice.invoiceNumber ? `Inv: ${invoice.invoiceNumber} • ` : ''}{invoice.date}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-gray-900">₹{invoice.amount.toLocaleString()}</p>
                            </div>
                          </div>
                        )) || (
                          <p className="text-gray-500 text-center py-4">No recent invoices</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Monthly Spend Trend */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Spend Trend</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      {dashboardData.monthlySpend && Object.entries(dashboardData.monthlySpend)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .slice(-6)
                        .map(([month, amount]: [string, any]) => (
                          <div key={month} className="text-center">
                            <div className="text-xs text-gray-500 mb-1">{month}</div>
                            <div className="text-sm font-semibold text-gray-900">₹{amount.toLocaleString()}</div>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{
                                  width: `${Math.min((amount / (dashboardData.summary?.totalSpend || 1)) * 100, 100)}%`
                                }}
                              ></div>
                            </div>
                          </div>
                        )) || (
                          <div className="col-span-full text-center py-8">
                            <p className="text-gray-500">No monthly data available</p>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Dashboard Data</h3>
                    <p className="text-gray-500 mb-4">Upload some invoices to see your spending analytics</p>
                    <button
                      onClick={() => setActiveTab('invoices')}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Go to Invoices
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
