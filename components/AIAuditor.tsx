import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, X, Send, Loader2, ChevronDown, Bot, User, Sparkles } from 'lucide-react';
import { AccountStructure, GroupNode, CampaignNode, CreativeNode, SegmentNode } from '../types';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface TaggedEntity {
  id: string;
  name: string;
  type: 'group' | 'campaign' | 'creative' | 'audience';
}

interface EntityOption {
  id: string;
  name: string;
  type: 'group' | 'campaign' | 'creative' | 'audience';
  parentName?: string;
}

interface AIAuditorProps {
  data: AccountStructure | null;
  accountId: string;
  isLiveData: boolean;
}

export const AIAuditor: React.FC<AIAuditorProps> = ({ data, accountId, isLiveData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showEntityPicker, setShowEntityPicker] = useState(false);
  const [entityFilter, setEntityFilter] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [taggedEntities, setTaggedEntities] = useState<TaggedEntity[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const entityPickerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getAllEntities = useCallback((): EntityOption[] => {
    if (!data) return [];
    
    const entities: EntityOption[] = [];
    
    data.groups.forEach((group: GroupNode) => {
      entities.push({
        id: group.id,
        name: group.name,
        type: 'group'
      });
      
      group.children.forEach((campaign: CampaignNode) => {
        entities.push({
          id: campaign.id,
          name: campaign.name,
          type: 'campaign',
          parentName: group.name
        });
        
        campaign.children.forEach((creative: CreativeNode) => {
          entities.push({
            id: creative.id,
            name: creative.name || `Creative ${creative.id}`,
            type: 'creative',
            parentName: campaign.name
          });
        });
      });
    });
    
    if (data.segments) {
      data.segments.forEach((segment: SegmentNode) => {
        entities.push({
          id: segment.id,
          name: segment.name,
          type: 'audience'
        });
      });
    }
    
    return entities;
  }, [data]);

  const filteredEntities = useCallback(() => {
    const all = getAllEntities();
    if (!entityFilter) return all;
    
    const lower = entityFilter.toLowerCase();
    return all.filter(e => 
      e.name.toLowerCase().includes(lower) ||
      e.type.toLowerCase().includes(lower)
    );
  }, [getAllEntities, entityFilter]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart || 0;
    setInputValue(value);
    setCursorPosition(position);
    
    const textBeforeCursor = value.substring(0, position);
    const slashIndex = textBeforeCursor.lastIndexOf('/');
    
    if (slashIndex !== -1 && (slashIndex === 0 || value[slashIndex - 1] === ' ')) {
      const filterText = textBeforeCursor.substring(slashIndex + 1);
      if (!filterText.includes(' ')) {
        setEntityFilter(filterText);
        setShowEntityPicker(true);
        return;
      }
    }
    
    setShowEntityPicker(false);
    setEntityFilter('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showEntityPicker) {
        const entities = filteredEntities();
        if (entities.length > 0) {
          selectEntity(entities[0]);
        }
      } else {
        handleSend();
      }
    }
    
    if (e.key === 'Escape') {
      setShowEntityPicker(false);
    }
  };

  const selectEntity = (entity: EntityOption) => {
    const textBeforeCursor = inputValue.substring(0, cursorPosition);
    const slashIndex = textBeforeCursor.lastIndexOf('/');
    const textAfterSlash = inputValue.substring(cursorPosition);
    
    const newText = textBeforeCursor.substring(0, slashIndex) + 
      `@[${entity.name}]` + 
      textAfterSlash;
    
    setInputValue(newText);
    setTaggedEntities([...taggedEntities, {
      id: entity.id,
      name: entity.name,
      type: entity.type
    }]);
    setShowEntityPicker(false);
    setEntityFilter('');
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setTaggedEntities([]);
    setIsLoading(true);
    
    const assistantMessageId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    }]);
    
    try {
      const response = await fetch('/api/ai/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputValue,
          taggedEntities,
          accountId,
          isLiveData,
          accountData: data,
          conversationHistory: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to get response');
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          fullContent += chunk;
          
          setMessages(prev => prev.map(m => 
            m.id === assistantMessageId 
              ? { ...m, content: fullContent }
              : m
          ));
        }
      }
      
      setMessages(prev => prev.map(m => 
        m.id === assistantMessageId 
          ? { ...m, isStreaming: false }
          : m
      ));
      
    } catch (error) {
      console.error('AI request failed:', error);
      setMessages(prev => prev.map(m => 
        m.id === assistantMessageId 
          ? { ...m, content: 'Sorry, I encountered an error. Please try again.', isStreaming: false }
          : m
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'group': return 'bg-purple-100 text-purple-700';
      case 'campaign': return 'bg-blue-100 text-blue-700';
      case 'creative': return 'bg-green-100 text-green-700';
      case 'audience': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'group': return '📁';
      case 'campaign': return '📊';
      case 'creative': return '🎨';
      case 'audience': return '👥';
      default: return '📌';
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-[#0077b5] to-[#005f8e] text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 group"
        title="Open AI Auditor"
      >
        <Sparkles className="w-6 h-6" />
        <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
          AI
        </span>
      </button>
    );
  }

  return (
    <div 
      className={`fixed bottom-6 right-6 z-50 bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col transition-all duration-200 ${
        isMinimized ? 'w-80 h-14' : 'w-96 h-[32rem]'
      }`}
    >
      <div 
        className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#0077b5] to-[#005f8e] text-white rounded-t-xl cursor-pointer"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <span className="font-semibold">AI Auditor</span>
          {isLiveData && (
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Live</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
            className="p-1 hover:bg-white/20 rounded"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${isMinimized ? 'rotate-180' : ''}`} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
            className="p-1 hover:bg-white/20 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <Bot className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium text-gray-700 mb-2">Welcome to AI Auditor</p>
                <p className="text-sm mb-4">Ask me anything about your campaigns!</p>
                <div className="text-left bg-gray-50 rounded-lg p-3 text-sm">
                  <p className="font-medium text-gray-700 mb-2">Try asking:</p>
                  <ul className="space-y-1 text-gray-600">
                    <li>"Give me a summary of active campaigns"</li>
                    <li>"What's the targeting for /[campaign name]?"</li>
                    <li>"How is /[campaign] performing?"</li>
                    <li>"Compare audiences across campaigns"</li>
                  </ul>
                  <p className="mt-3 text-xs text-gray-400">
                    Type <span className="font-mono bg-gray-200 px-1 rounded">/</span> to tag specific entities
                  </p>
                </div>
              </div>
            )}
            
            {messages.map((message) => (
              <div 
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.role === 'user' 
                    ? 'bg-gray-100' 
                    : 'bg-gradient-to-r from-[#0077b5] to-[#005f8e]'
                }`}>
                  {message.role === 'user' 
                    ? <User className="w-4 h-4 text-gray-600" />
                    : <Bot className="w-4 h-4 text-white" />
                  }
                </div>
                <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-gray-100 text-gray-800'
                    : 'bg-blue-50 text-gray-800'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  {message.isStreaming && (
                    <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1" />
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t relative">
            {showEntityPicker && (
              <div 
                ref={entityPickerRef}
                className="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-lg shadow-xl border border-gray-200 max-h-64 overflow-y-auto"
              >
                <div className="p-2 border-b bg-gray-50 sticky top-0">
                  <p className="text-xs text-gray-500 font-medium">Select an entity</p>
                </div>
                {filteredEntities().length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No matching entities found
                  </div>
                ) : (
                  <div className="p-1">
                    {['group', 'campaign', 'creative', 'audience'].map(type => {
                      const typeEntities = filteredEntities().filter(e => e.type === type);
                      if (typeEntities.length === 0) return null;
                      
                      return (
                        <div key={type}>
                          <div className="px-2 py-1 text-xs font-medium text-gray-400 uppercase">
                            {type}s
                          </div>
                          {typeEntities.slice(0, 5).map(entity => (
                            <button
                              key={entity.id}
                              onClick={() => selectEntity(entity)}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded flex items-center gap-2"
                            >
                              <span>{getTypeIcon(entity.type)}</span>
                              <span className="flex-1 truncate text-sm">{entity.name}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${getTypeColor(entity.type)}`}>
                                {entity.type}
                              </span>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your campaigns... (type / to tag)"
                className="flex-1 resize-none border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077b5] focus:border-transparent"
                rows={2}
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                className="self-end px-4 py-2 bg-[#0077b5] text-white rounded-lg hover:bg-[#005f8e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
            
            {taggedEntities.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {taggedEntities.map((entity, i) => (
                  <span 
                    key={i}
                    className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${getTypeColor(entity.type)}`}
                  >
                    {getTypeIcon(entity.type)} {entity.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
