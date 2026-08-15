'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
}

const quickPrompts = [
  "How can I increase flower sales?",
  "Wedding stage decoration ideas",
  "Instagram caption for bouquet",
  "How to reduce flower wastage?",
];

const popularTopics = [
  { icon: "💐", label: "Wedding Decoration" },
  { icon: "🌹", label: "Bouquet Design" },
  { icon: "📱", label: "Marketing Tips" },
  { icon: "💰", label: "Pricing Guide" },
  { icon: "🌿", label: "Flower Care" },
  { icon: "📈", label: "Business Growth" },
];

const exampleQuestions = [
  "How to price a wedding stage?",
  "Best flowers for summer?",
  "How can I increase Google reviews?",
  "Car decoration pricing?",
];

export default function FloristMitra() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchSessions = async () => {
    try {
      const response = await fetch('../api/florist-mitra/sessions');
      const data = await response.json();
      if (data.sessions) {
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  useEffect(() => {
    document.title = 'Flora Receptionist | Floraprise';
    void Promise.resolve().then(fetchSessions);
  }, []);

  const focusInput = () => {
    inputRef.current?.focus();
  };

  const startNewChat = () => {
    setSessionId(null);
    setMessages([]);
    setShowHistory(false);
  };

  const loadSession = async (sessionId: string) => {
    try {
      const response = await fetch(`../api/florist-mitra/sessions/${sessionId}`);
      const data = await response.json();
      if (data.messages) {
        setMessages(data.messages);
        setSessionId(sessionId);
        setShowHistory(false);
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`../api/florist-mitra/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      setSessions(sessions.filter(s => s.id !== sessionId));
      if (sessionId === sessionId) {
        startNewChat();
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: message };
    setMessages([...messages, userMessage]);
    setMessage('');
    setLoading(true);

    try {
      const response = await fetch('../api/florist-mitra/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          sessionId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        
        if (response.status === 401) {
          setMessages([...messages, userMessage, { role: 'assistant', content: 'You need to be logged in to use Flora Receptionist.' }]);
        } else if (response.status === 429) {
          setMessages([...messages, userMessage, { role: 'assistant', content: 'You have reached your monthly question limit. Please try again next month.' }]);
        } else {
          setMessages([...messages, userMessage, { role: 'assistant', content: `Error: ${response.status}. Please try again.` }]);
        }
        return;
      }

      const data = await response.json();
      
      if (data.reply) {
        setMessages([...messages, userMessage, { role: 'assistant', content: data.reply }]);
        setSessionId(data.sessionId);
        fetchSessions();
      } else if (data.error) {
        setMessages([...messages, userMessage, { role: 'assistant', content: data.error }]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages([...messages, userMessage, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-4 lg:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 lg:mb-6">
          <button
            onClick={startNewChat}
            className="flex items-center gap-2 bg-green-700 text-white px-3 lg:px-4 py-2 rounded-xl hover:bg-green-800 transition text-sm lg:text-base"
          >
            <Plus className="w-4 h-4 lg:w-5 lg:h-5" />
            <span className="font-semibold">New Chat</span>
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 bg-white px-3 lg:px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition text-sm lg:text-base"
          >
            <Sparkles className="w-4 h-4 lg:w-5 lg:h-5 text-green-700" />
            <span className="font-semibold text-gray-700">History</span>
          </button>
        </div>

        {showHistory && (
          <div className="mb-4 lg:mb-6 bg-white rounded-2xl shadow-sm p-4 lg:p-6">
            <h2 className="text-lg lg:text-xl font-bold text-gray-900 mb-4">Chat History</h2>
            {sessions.length === 0 ? (
              <p className="text-gray-500">No previous conversations</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => loadSession(session.id)}
                    className="flex items-center justify-between p-3 lg:p-4 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer transition"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{session.title}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(session.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => deleteSession(session.id, e)}
                      className="text-red-600 hover:text-red-800 p-2 ml-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
          {/* Chat Area */}
          <div className="col-span-1 lg:col-span-9">
            {/* Welcome Banner */}
            {messages.length === 0 && (
              <div className="bg-gradient-to-br from-green-900 via-green-800 to-emerald-700 rounded-2xl p-5 lg:p-8 border border-green-700 mb-4 lg:mb-6 text-white shadow-sm overflow-hidden relative">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-lime-300 via-white to-lime-200" />
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                  <div className="flex items-start gap-3 lg:gap-4">
                    <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-2xl lg:text-3xl flex-shrink-0">
                      🌸
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-lime-100 mb-2">Flora Receptionist</p>
                      <h1 className="text-2xl lg:text-4xl font-bold">
                        Your Smart Receptionist for Florists.
                      </h1>
                      <p className="text-green-50 mt-2 text-sm lg:text-base">
                        Available 24×7 to welcome customers, answer enquiries, recommend flowers, capture leads and help you never miss a flower order.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={focusInput}
                    className="self-start lg:self-center bg-white text-green-800 px-5 py-3 rounded-xl hover:bg-lime-50 transition text-sm lg:text-base font-bold shadow-sm"
                  >
                    Start Conversation
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 lg:gap-3 mt-6">
                  {['Welcome customers', 'Answer enquiries', 'Recommend flowers', 'Capture leads', 'Never miss an order'].map((item) => (
                    <div key={item} className="bg-white/10 border border-white/15 rounded-xl px-3 py-3 text-sm text-green-50">
                      {item}
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t border-white/15">
                  <p className="text-sm font-semibold text-lime-100 mb-3">Popular customer conversations</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 lg:gap-3">
                    {quickPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => setMessage(prompt)}
                        className="p-3 lg:p-4 bg-white/95 text-gray-800 rounded-xl hover:bg-white text-left transition text-sm lg:text-base"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Chat Messages */}
            <div className="bg-white rounded-2xl shadow-sm border min-h-[400px] lg:min-h-[500px] max-h-[500px] lg:max-h-[600px] overflow-y-auto p-4 lg:p-6 space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b">
                <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-green-100 flex items-center justify-center text-xl lg:text-2xl flex-shrink-0">
                    🌸
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg lg:text-xl font-bold text-gray-900">Flora Receptionist</h2>
                    <p className="text-gray-500 text-xs lg:text-sm">
                      Online • Ready to help your customers
                    </p>
                  </div>
                </div>
              {messages.length === 0 && (
                <div className="text-center py-10 lg:py-14 max-w-2xl mx-auto">
                  <div className="text-3xl lg:text-4xl mb-4">🌸</div>
                  <h3 className="text-xl lg:text-2xl font-bold text-gray-900 mb-3">Welcome 👋</h3>
                  <p className="text-gray-700 text-sm lg:text-base mb-2">I&apos;m Flora.</p>
                  <p className="text-gray-600 text-sm lg:text-base">
                    Your digital receptionist for florist businesses.
                  </p>
                  <p className="text-gray-600 text-sm lg:text-base mt-2">
                    I can help customers choose flowers, answer questions and capture enquiries.
                  </p>
                </div>
              )}
              {messages.map((msg, idx) => (
                <div key={idx}>
                  {msg.role === 'user' ? (
                    <div className="flex justify-end">
                      <div className="bg-green-600 text-white px-4 py-2 lg:px-5 lg:py-3 rounded-2xl max-w-[85%] lg:max-w-[70%] text-sm lg:text-base">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 lg:gap-3">
                      <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-green-100 flex items-center justify-center text-lg lg:text-xl flex-shrink-0">
                        🌸
                      </div>
                      <div className="bg-white border rounded-2xl px-4 py-3 lg:px-5 lg:py-4 max-w-[85%] lg:max-w-[80%] shadow-sm">
                        <div className="prose prose-sm max-w-none text-sm lg:text-base">
                          <ReactMarkdown>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-2 lg:gap-3">
                  <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-green-100 flex items-center justify-center text-lg lg:text-xl flex-shrink-0">
                    🌸
                  </div>
                  <div className="bg-white border rounded-2xl px-4 py-3 lg:px-5 lg:py-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce delay-100" />
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce delay-200" />
                      </div>
                      <span className="text-sm text-gray-600">Preparing the perfect floral suggestion...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Box */}
            <div className="sticky bottom-0 bg-white p-3 lg:p-4 border-t rounded-b-2xl mt-4">
              <div className="flex gap-2 lg:gap-3 bg-white border rounded-2xl p-2 shadow-sm">
                <input
                  ref={inputRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask Flora Receptionist anything..."
                  className="flex-1 outline-none px-3 text-sm lg:text-base"
                  disabled={loading}
                />
                <button
                  onClick={sendMessage}
                  disabled={loading || !message.trim()}
                  className="bg-green-600 text-white px-4 lg:px-5 py-2 rounded-xl hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm lg:text-base"
                >
                  Send
                </button>
              </div>
            </div>
            <p className="text-center text-xs text-gray-500 mt-3">Powered by Floraprise</p>
          </div>

          {/* Right Sidebar */}
          <div className="col-span-1 lg:col-span-3 space-y-4 lg:space-y-6">
            {/* Popular Topics */}
            <div className="bg-white rounded-2xl shadow-sm border p-4 lg:p-6">
              <h3 className="font-bold text-gray-900 mb-4 text-base lg:text-lg">Popular Topics</h3>
              <div className="space-y-2">
                {popularTopics.map((topic) => (
                  <button
                    key={topic.label}
                    onClick={() => setMessage(`Tell me about ${topic.label}`)}
                    className="w-full flex items-center gap-2 lg:gap-3 p-2 lg:p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition text-left"
                  >
                    <span className="text-lg lg:text-xl">{topic.icon}</span>
                    <span className="text-xs lg:text-sm font-medium text-gray-700">{topic.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Example Questions */}
            <div className="bg-white rounded-2xl shadow-sm border p-4 lg:p-6">
              <h3 className="font-bold text-gray-900 mb-4 text-base lg:text-lg">Example Questions</h3>
              <div className="space-y-2">
                {exampleQuestions.map((question) => (
                  <button
                    key={question}
                    onClick={() => setMessage(question)}
                    className="w-full p-2 lg:p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition text-left text-xs lg:text-sm text-gray-700"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl shadow-sm border p-4 lg:p-6">
              <h3 className="font-bold text-gray-900 mb-4 text-base lg:text-lg">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={startNewChat}
                  className="w-full flex items-center gap-2 lg:gap-3 p-2 lg:p-3 bg-green-50 rounded-xl hover:bg-green-100 transition text-left"
                >
                  <Plus className="w-4 h-4 lg:w-5 lg:h-5 text-green-600" />
                  <span className="text-xs lg:text-sm font-medium text-green-700">Start New Chat</span>
                </button>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="w-full flex items-center gap-2 lg:gap-3 p-2 lg:p-3 bg-blue-50 rounded-xl hover:bg-blue-100 transition text-left"
                >
                  <Sparkles className="w-4 h-4 lg:w-5 lg:h-5 text-blue-600" />
                  <span className="text-xs lg:text-sm font-medium text-blue-700">View History</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
