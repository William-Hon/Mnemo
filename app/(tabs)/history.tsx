import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, TextInput, Pressable, SafeAreaView, Keyboard, Alert, Modal, Platform, ScrollView, useWindowDimensions, KeyboardAvoidingView } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useFocusEffect } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { getUserEntries, searchEntries, deleteEntries, Entry } from '../../src/services/entries';
import { LocalAIService } from '../../src/services/LocalAIService';
import { useAuth } from '../../src/providers/AuthProvider';

// --- Simple Calendar Component ---
const SimpleCalendar = ({ 
  tempStart, 
  setTempStart, 
  tempEnd, 
  setTempEnd 
}: { 
  tempStart: string, setTempStart: (s: string) => void, 
  tempEnd: string, setTempEnd: (s: string) => void 
}) => {
  const [baseDate, setBaseDate] = useState(new Date());
  
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  
  const days = useMemo(() => {
    const arr = [];
    for (let i = 0; i < firstDay; i++) arr.push(null);
    for (let i = 1; i <= daysInMonth; i++) arr.push(i);
    return arr;
  }, [year, month, daysInMonth, firstDay]);

  const handleDayPress = (day: number) => {
    const clickedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(clickedDate);
      setTempEnd('');
    } else if (tempStart && !tempEnd) {
      if (new Date(clickedDate) < new Date(tempStart)) {
        setTempEnd(tempStart);
        setTempStart(clickedDate);
      } else {
        setTempEnd(clickedDate);
      }
    }
  };

  const prevMonth = () => setBaseDate(new Date(year, month - 1, 1));
  const nextMonth = () => setBaseDate(new Date(year, month + 1, 1));

  return (
    <View className="mb-2 w-full">
      <View className="flex-row justify-between items-center mb-2 px-1">
        <Pressable onPress={prevMonth} className="p-1"><Text className="text-white font-bold">&lt;</Text></Pressable>
        <Text className="text-white font-bold text-xs uppercase tracking-widest">
          {baseDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </Text>
        <Pressable onPress={nextMonth} className="p-1"><Text className="text-white font-bold">&gt;</Text></Pressable>
      </View>
      <View className="flex-row flex-wrap">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <View key={`header-${i}`} className="w-[14%] items-center mb-1">
            <Text className="text-gray-400 text-[10px] font-bold">{d}</Text>
          </View>
        ))}
        {days.map((day, i) => {
          if (!day) return <View key={`empty-${i}`} className="w-[14%] h-7" />;
          const currentStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isStart = tempStart === currentStr;
          const isEnd = tempEnd === currentStr;
          const isBetween = tempStart && tempEnd && new Date(currentStr) > new Date(tempStart) && new Date(currentStr) < new Date(tempEnd);
          
          let bgClass = "bg-transparent";
          let textClass = "text-gray-300";
          
          if (isStart || isEnd) {
            bgClass = "bg-blue-500 rounded-sm";
            textClass = "text-white font-bold";
          } else if (isBetween) {
            bgClass = "bg-blue-500/20";
            textClass = "text-blue-400";
          }

          return (
            <Pressable key={`day-${i}`} onPress={() => handleDayPress(day)} className={`w-[14%] h-7 items-center justify-center ${bgClass}`}>
              <Text className={`text-xs ${textClass}`}>{day}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const ResponsiveModal = ({ visible, children }: any) => {
  if (!visible) return null;
  if (Platform.OS === 'web') {
    return (
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 9999 }} className="bg-black/60 items-center justify-center p-2 sm:p-4">
        {children}
      </View>
    );
  }
  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-black/60 items-center justify-center p-2 sm:p-4">
        {children}
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default function HistoryScreen() {

  const { height, width } = useWindowDimensions();
  const isMobile = width < 768;
  const calendarScale = Math.min(1.2, Math.max(0.4, (height - 200) / 450));
  
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');
  
  // Filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Selection Modals
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempStart, setTempStart] = useState('');
  const [tempEnd, setTempEnd] = useState('');

  // Bulk Actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<'delete' | 'export' | null>(null);
  const [hasModel, setHasModel] = useState(false);
  const [showAiTooltip, setShowAiTooltip] = useState(false);

  const checkModel = async () => {
    const isDownloaded = await LocalAIService.isModelDownloaded();
    setHasModel(isDownloaded);
  };

  // Single Reading Modal
  const [selectedEntryToRead, setSelectedEntryToRead] = useState<any>(null);

  // Chat Feature
  const scrollViewRef = React.useRef<ScrollView>(null);
  const [chatHistory, setChatHistory] = useState<{role: 'user'|'assistant', content: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatThinking, setIsChatThinking] = useState(false);
  const [chatLoadingText, setChatLoadingText] = useState('THINKING...');
  const [showChat, setShowChat] = useState(false);

  const { user } = useAuth();

  const fetchContent = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const parsedStart = startDate.trim().length > 0 ? new Date(startDate).toISOString() : undefined;
      const parsedEnd = endDate.trim().length > 0 ? new Date(endDate).toISOString() : undefined;

      if (query.trim().length > 0) {
        setIsSearching(true);
        const data = await searchEntries(query.trim(), undefined, parsedStart, parsedEnd);
        setEntries(data);
      } else {
        setIsSearching(false);
        const data = await getUserEntries(undefined, parsedStart, parsedEnd);
        setEntries(data);
      }
    } catch (error) {
      console.error('Failed to fetch:', error);
      Alert.alert('Error', 'Failed to fetch your journal entries.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchContent();
      checkModel();
    }, [user])
  );

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchContent();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [startDate, endDate, query]);

  const askPrivateLLM = async () => {
    try {
      const isCompatible = await LocalAIService.checkCompatibility();
      if (!isCompatible) {
        Alert.alert("Not Supported", "Private AI is not supported on this device yet.");
        return;
      }
      const isDownloaded = await LocalAIService.isModelDownloaded();
      if (!isDownloaded) {
        Alert.alert("Model Not Downloaded", "Please go to the Settings tab to download the AI model first.");
        return;
      }

      setShowChat(true);
      
      // Auto-scroll to bottom of modal
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 300);
      
      setIsChatThinking(true);
      try {
        if (!LocalAIService.isInitialized) {
          setChatLoadingText('LOADING AI...');
          await LocalAIService.initAndDownload(() => {});
        }
        
        setChatLoadingText('READING YOUR JOURNAL...');
        const journalContext = selectedEntryToRead?.fullContent || selectedEntryToRead?.content || '';
        await LocalAIService.warmupJournal(journalContext);
        
        setChatHistory([
          { role: 'assistant', content: "Journal loaded. Ask anything about it." }
        ]);
      } catch (e: any) {
        Alert.alert("AI Error", e.message);
      } finally {
        setIsChatThinking(false);
      }
    } catch (e: any) {
      Alert.alert("AI Error", e.message);
    }
  };

  const sendMessageToLLM = async () => {
    if (!chatInput.trim() || isChatThinking) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    // Insert user message and an empty placeholder for the assistant
    setChatHistory(prev => [
      ...prev, 
      { role: 'user', content: userMessage },
      { role: 'assistant', content: '' }
    ]);
    setChatLoadingText('THINKING...');
    setIsChatThinking(true);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      if (!LocalAIService.isInitialized) {
        await LocalAIService.initAndDownload(() => {});
      }
      const journalContext = selectedEntryToRead?.fullContent || selectedEntryToRead?.content || '';
      
      // We only want to send the actual history, not the empty placeholder we just added
      const newHistory = chatHistory.concat([{ role: 'user', content: userMessage }]) as {role: 'user'|'assistant', content: string}[];
      
      const response = await LocalAIService.chat(journalContext, newHistory, (text) => {
        // Stream the text into the placeholder
        setChatHistory(prev => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          updated[updated.length - 1].content = text;
          return updated;
        });
      });
      
      // Final overwrite just in case
      setChatHistory(prev => {
        if (prev.length === 0) return prev;
        const updated = [...prev];
        updated[updated.length - 1].content = response;
        return updated;
      });
    } catch (e: any) {
      Alert.alert("AI Error", e.message);
      // Remove the empty assistant message if it failed
      setChatHistory(prev => prev.slice(0, -1));
    } finally {
      setIsChatThinking(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchContent();
  };

  const toggleBulkSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmAction('delete');
  };

  const confirmBulkExport = () => {
    if (selectedIds.size === 0) return;
    setConfirmAction('export');
  };

  const executeBulkAction = async () => {
    if (confirmAction === 'delete') {
      const entriesToDelete = entries.filter(e => selectedIds.has(e.entry_id || e.id));
      try {
        setLoading(true);
        await deleteEntries(entriesToDelete);
        setSelectedIds(new Set());
        await fetchContent();
      } catch (err) {
        Alert.alert('Error', 'Failed to delete entries.');
      } finally {
        setLoading(false);
        setConfirmAction(null);
      }
    } else if (confirmAction === 'export') {
      const entriesToExport = entries.filter(e => selectedIds.has(e.entry_id || e.id));
      setConfirmAction(null); // Close the modal FIRST so iOS Share Sheet doesn't get destroyed
      
      // We must wait for the modal to fully close (iOS takes ~400ms for modal animations)
      // before we trigger the native share sheet, otherwise it will instantly disappear.
      setTimeout(async () => {
        try {
          setLoading(true); // This will show the spinner on the main screen
          await generateExport(entriesToExport);
          setSelectedIds(new Set());
        } catch (err) {
          console.error("Export failed:", err);
          Alert.alert('Error', 'Failed to export entries.');
        } finally {
          setLoading(false);
        }
      }, 500);
    }
  };

  const generateExport = async (entriesToExport: any[]) => {
    let htmlContent = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body { background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
            .entry-container { margin-bottom: 40px; background-color: #ffffff; }
            .header { border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 20px; background-color: #ffffff; }
            .date { font-size: 24px; font-weight: bold; color: #111827; }
            .meta { font-size: 14px; color: #6b7280; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
            .content { font-size: 16px; line-height: 1.6; white-space: pre-wrap; background-color: #ffffff; }
          </style>
        </head>
        <body>
    `;

    entriesToExport.forEach((entry, idx) => {
      const date = new Date(entry.created_at);
      htmlContent += `
        <div class="entry-container" style="${idx > 0 ? 'page-break-before: always;' : 'page-break-before: avoid;'}">
          <div class="header">
            <div class="date">${date.toLocaleDateString()} at ${date.toLocaleTimeString()}</div>
            <div class="meta">${entry.entry_type === 'voice' ? '&#127908; Voice Entry' : '&#9997; Text Entry'}</div>
          </div>
          <div class="content">${(entry.fullContent || entry.content).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>
      `;
    });

    htmlContent += `</body></html>`;

    if (Platform.OS === 'web') {
      const generateAndDownload = () => {
        const element = document.createElement('div');
        element.innerHTML = htmlContent;
        const opt = {
          margin: 0.5,
          filename: 'journal_entries.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        // @ts-ignore
        window.html2pdf().set(opt).from(element).save();
      };

      // @ts-ignore
      if (window.html2pdf) {
        generateAndDownload();
      } else {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = generateAndDownload;
        document.body.appendChild(script);
      }
    } else {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    }
  };

  const executeBulkExportClipboard = async () => {
    try {
      const entriesToExport = entries.filter(e => selectedIds.has(e.entry_id || e.id));
      let textContent = ``;
      entriesToExport.forEach((entry, idx) => {
        const date = new Date(entry.created_at);
        const type = entry.entry_type === 'voice' ? '🎙️  Voice Entry' : '✍️ Text Entry';
        textContent += `${date.toLocaleDateString()} at ${date.toLocaleTimeString()}\n${type}\n\n${entry.fullContent || entry.content}\n\n`;
        if (idx < entriesToExport.length - 1) textContent += `----------------------------------------\n\n`;
      });
      await Clipboard.setStringAsync(textContent);
      
      // Close the modal first
      setConfirmAction(null);
      setSelectedIds(new Set());
      
      // Then show the alert
      setTimeout(() => {
        Alert.alert('Success', 'Entries copied to clipboard!');
      }, 100);
      
    } catch (err) {
      setConfirmAction(null);
      setTimeout(() => Alert.alert('Error', 'Failed to copy to clipboard.'), 100);
    }
  };

  const applyDateFilter = () => {
    setStartDate(tempStart);
    setEndDate(tempEnd);
    setShowDatePicker(false);
  };

  const clearDateFilter = () => {
    setTempStart('');
    setTempEnd('');
    setStartDate('');
    setEndDate('');
    setShowDatePicker(false);
  };

  const deleteSingleEntry = async (entry: any) => {
    Alert.alert("Confirm Delete", "Are you sure you want to permanently delete this entry?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await deleteEntries([entry]);
          setSelectedEntryToRead(null);
          await fetchContent();
        } catch (e) {
          Alert.alert("Error", "Could not delete entry.");
        }
      }}
    ]);
  };

  const renderItem = ({ item, index }: { item: any, index: number }) => {
    const actualId = item.entry_id || item.id;
    const isSelected = selectedIds.has(actualId);
    const isSearchResult = !!item.finalRank;
    
    // Fallback display text
    let displayText = item.content || "";
    let trimmedChunk = "";
    
    if (isSearchResult && item.chunk_text) {
      trimmedChunk = item.chunk_text.trim();
      const chunkIndex = displayText.indexOf(trimmedChunk);
      if (chunkIndex > -1) {
        const start = Math.max(0, chunkIndex - 60);
        const end = Math.min(displayText.length, chunkIndex + trimmedChunk.length + 60);
        displayText = (start > 0 ? "..." : "") + displayText.substring(start, end) + (end < displayText.length ? "..." : "");
      }
    }

    const numColumns = width < 520 
      ? 1 
      : width < 780 
        ? 2 
        : width < 1080 
          ? 3 
          : width < 1400 
            ? 4 
            : 5;
    const gap = 32;
    const currentContainerW = Math.min(width - 32, 1280);
    const cardWidth = numColumns === 1 
      ? Math.min(currentContainerW, 320)
      : Math.floor((currentContainerW - (gap * (numColumns - 1))) / numColumns);

    const cardFlexBasis = numColumns === 1 
      ? (width < 520 ? '100%' : '320px')
      : `calc(${(100 / numColumns).toFixed(3)}% - ${(gap * (numColumns - 1) / numColumns).toFixed(1)}px)`;

    const maxTextLines = numColumns === 1 
      ? (item.journalBrief ? 8 : 12)
      : numColumns === 2 
        ? (item.journalBrief ? 6 : 10)
        : numColumns === 3 
          ? (item.journalBrief ? 5 : 8)
          : numColumns === 4 
            ? (item.journalBrief ? 4 : 7)
            : (item.journalBrief ? 3 : 6);

    const neumorphicCardStyle = [
      {
        backgroundColor: isSelected ? '#121c33' : '#0d121d',
        borderColor: isSelected ? 'rgba(96, 165, 250, 0.65)' : 'rgba(59, 130, 246, 0.25)',
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: isSelected ? 0.9 : 0.7,
        shadowRadius: 22,
        elevation: 8,
        transform: [{ translateY: -3 }],
      },
      Platform.OS === 'web'
        ? ({
            width: cardFlexBasis as any,
            aspectRatio: 1,
            boxShadow: isSelected
              ? '0 0 24px 4px rgba(96, 165, 250, 0.75), 0 0 48px 8px rgba(59, 130, 246, 0.55), 0 0 75px 12px rgba(37, 99, 235, 0.35), 0 16px 36px -4px rgba(0, 0, 0, 0.85), inset 0 1px 1px 0 rgba(191, 219, 254, 0.45)'
              : '0 0 20px 3px rgba(59, 130, 246, 0.55), 0 0 42px 6px rgba(37, 99, 235, 0.38), 0 0 65px 8px rgba(29, 78, 216, 0.2), 0 14px 28px -4px rgba(0, 0, 0, 0.8), inset 0 1px 1px 0 rgba(255, 255, 255, 0.14)',
            transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          } as any)
        : ({
            width: cardWidth,
            aspectRatio: 1,
          } as any),
    ];

    return (
      <Pressable 
        onPress={() => setSelectedEntryToRead(item)}
        onLongPress={() => toggleBulkSelection(actualId)}
        style={neumorphicCardStyle}
        className="p-4 sm:p-5 rounded-[22px] border overflow-hidden justify-between active:scale-[0.99] active:opacity-95"
      >
        <View className="flex-1 overflow-hidden justify-between">
          <View className="overflow-hidden">
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-row items-center gap-1.5 flex-wrap flex-1 pr-1.5">
                {isSearchResult && (
                  <View className="bg-blue-500/15 px-2 py-0.5 rounded-full mr-1 border border-blue-500/30">
                    <Text className="text-blue-400 font-bold text-[10.5px]">
                      #{item.finalRank}
                    </Text>
                  </View>
                )}
                <View className="flex-row items-center gap-1.5">
                  <SymbolView 
                    name={item.entry_type === 'voice' ? { ios: 'mic.fill', android: 'mic', web: 'mic' } as any : { ios: 'doc.text.fill', android: 'description', web: 'description' } as any} 
                    tintColor="#94a3b8" 
                    size={14} 
                  />
                  <Text className="text-slate-400 font-medium text-[11.5px]">
                    {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </View>

              <Pressable onPress={() => toggleBulkSelection(actualId)} className="p-1 -mt-1 -mr-1 active:opacity-50">
                <SymbolView 
                  name={isSelected ? { ios: 'checkmark.square.fill', android: 'check_box', web: 'check_box' } as any : { ios: 'square', android: 'check_box_outline_blank', web: 'check_box_outline_blank' } as any} 
                  tintColor={isSelected ? '#3b82f6' : '#4b5563'} 
                  size={19} 
                />
              </Pressable>
            </View>
            
            <Text 
              className="text-slate-100 text-[13.5px] font-normal" 
              numberOfLines={maxTextLines}
              ellipsizeMode="tail"
              style={[
                { lineHeight: 20 },
                Platform.OS === 'web' ? ({
                  display: '-webkit-box',
                  WebkitLineClamp: maxTextLines,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxHeight: maxTextLines * 20,
                } as any) : undefined
              ]}
            >
              {displayText}
            </Text>
          </View>

          {item.journalBrief && (
            <View 
              style={[
                {
                  backgroundColor: '#070b12',
                  borderColor: 'rgba(255, 255, 255, 0.04)',
                },
                Platform.OS === 'web' ? ({
                  boxShadow: 'inset 0 2px 6px 0 rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(255, 255, 255, 0.02)',
                } as any) : undefined
              ]}
              className="mt-2.5 p-2.5 rounded-xl border gap-1"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1">
                  <SymbolView name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' } as any} tintColor="#3b82f6" size={12} />
                  <Text className="text-[10.5px] font-bold text-gray-200 uppercase tracking-wider">Brief</Text>
                </View>
                {item.deepRelevance > 0 && (
                  <Text className={`text-[8.5px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded-full ${
                    item.deepRelevance === 3 ? 'text-green-400 bg-green-950/40 border border-green-800/30' :
                    item.deepRelevance === 2 ? 'text-blue-400 bg-blue-950/40 border border-blue-800/30' :
                    'text-gray-400 bg-gray-800/40 border border-gray-700/30'
                  }`}>
                    {item.deepRelevance === 3 ? 'MATCH' : item.deepRelevance === 2 ? 'RELATED' : 'WEAK'}
                  </Text>
                )}
              </View>
              <Text className="text-gray-300 text-[11.5px] leading-snug font-normal" numberOfLines={2}>
                {item.journalBrief}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView 
      className="flex-1 bg-black"
      style={Platform.OS === 'web' ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as any : {}}
    >
      <ScrollView 
        className="flex-1"
        style={{ height: '100%' }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100, alignItems: 'center' }}
        showsVerticalScrollIndicator={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="w-full max-w-7xl self-center">
        {/* Top Header / Action Bar */}
        {selectedIds.size > 0 ? (
          <View 
            style={[
              {
                backgroundColor: '#0d121d',
                borderColor: 'rgba(255, 255, 255, 0.05)',
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.5,
                shadowRadius: 18,
                elevation: 5,
              },
              Platform.OS === 'web' ? ({
                boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.65), inset 0 1px 0 0 rgba(255, 255, 255, 0.08), 0 0 20px -2px rgba(59, 130, 246, 0.05)',
              } as any) : undefined
            ]}
            className="flex-row items-center justify-between border rounded-[22px] p-4 px-5 mb-5 mt-8"
          >
            <Text className="text-gray-100 font-bold text-base tracking-wider">
              {selectedIds.size} SELECTED
            </Text>
            <View className="flex-row gap-3">
              <Pressable 
                onPress={() => setSelectedIds(new Set())} 
                className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl active:bg-white/[0.06]"
              >
                <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' } as any} tintColor="#9ca3af" size={16} />
                <Text className="text-gray-300 text-xs font-bold uppercase tracking-wider hidden sm:flex">Deselect All</Text>
              </Pressable>
              <Pressable 
                onPress={confirmBulkExport} 
                className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 active:bg-blue-500/20"
              >
                <SymbolView name={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' } as any} tintColor="#60a5fa" size={16} />
                <Text className="text-blue-400 text-xs font-bold uppercase tracking-wider hidden sm:flex">Export All</Text>
              </Pressable>
              <Pressable 
                onPress={confirmBulkDelete} 
                className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 active:bg-red-500/20"
              >
                <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' } as any} tintColor="#ef4444" size={16} />
                <Text className="text-red-500 text-xs font-bold uppercase tracking-wider hidden sm:flex">Delete All</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View className="flex-row justify-between items-center mb-6 mt-8">
            <Text className="text-white font-bold text-2xl tracking-tight">Journals</Text>
          </View>
        )}

        {/* Search and Filters */}
        <View style={{ flexDirection: isMobile ? 'column' : 'row', width: '100%', zIndex: 50 }} className="gap-3.5 mb-10 sm:mb-7 relative z-50">
          <View 
            style={[
              {
                flex: isMobile ? undefined : 1,
                width: '100%',
                height: 58,
                backgroundColor: '#0d121d',
                borderColor: 'rgba(255, 255, 255, 0.06)',
                shadowColor: '#3b82f6',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.15,
                shadowRadius: 18,
                elevation: 4,
              },
              Platform.OS === 'web' ? ({
                boxShadow: '0 10px 28px -4px rgba(0, 0, 0, 0.6), inset 0 1px 0 0 rgba(255, 255, 255, 0.08), 0 0 20px -2px rgba(59, 130, 246, 0.08)',
              } as any) : undefined
            ]} 
            className="flex-row items-center border rounded-2xl px-5 h-[58px] shadow-sm"
          >
            <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' } as any} tintColor="#9ca3af" size={20} />
            <TextInput
              className="flex-1 ml-3 text-white text-base h-full outline-none font-normal"
              placeholder="Search journals"
              placeholderTextColor="#6b7280"
              value={query}
              onChangeText={setQuery}
              style={Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} className="p-1.5 active:opacity-50">
                <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' } as any} tintColor="#9ca3af" size={18} />
              </Pressable>
            )}
          </View>
          
          <View className="flex-row gap-3.5 relative z-50" style={{ width: isMobile ? '100%' : 'auto' }}>
            <View className="relative z-50" style={{ flex: isMobile ? 1 : undefined }}>
              <Pressable 
                onPress={() => setShowDatePicker(!showDatePicker)}
                style={[
                  {
                    flex: isMobile ? 1 : undefined,
                    width: isMobile ? undefined : 'auto',
                    height: 58,
                    backgroundColor: startDate || endDate ? '#121c33' : '#0d121d',
                    borderColor: startDate || endDate ? 'rgba(59, 130, 246, 0.45)' : 'rgba(255, 255, 255, 0.06)',
                    shadowColor: startDate || endDate ? '#3b82f6' : '#000000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: startDate || endDate ? 0.3 : 0.45,
                    shadowRadius: 16,
                    elevation: 4,
                  },
                  Platform.OS === 'web' ? ({
                    boxShadow: startDate || endDate
                      ? '0 10px 28px -4px rgba(0, 0, 0, 0.6), 0 0 24px -2px rgba(59, 130, 246, 0.35), inset 0 1px 1px 0 rgba(147, 197, 253, 0.25)'
                      : '0 10px 28px -4px rgba(0, 0, 0, 0.55), inset 0 1px 0 0 rgba(255, 255, 255, 0.08), 0 0 18px -2px rgba(59, 130, 246, 0.08)',
                  } as any) : undefined
                ]}
                className="flex-row items-center justify-center border px-5 h-[58px] rounded-2xl active:bg-[#111728]"
              >
                <SymbolView name={{ ios: 'calendar', android: 'calendar_today', web: 'calendar_today' } as any} tintColor={startDate || endDate ? '#3b82f6' : '#9ca3af'} size={19} />
                <Text className={`ml-2.5 text-sm sm:text-base font-bold ${startDate || endDate ? 'text-blue-400' : 'text-gray-200'}`}>
                  Date Range
                </Text>
              </Pressable>

              {/* Simple Date Picker Dropdown */}
              {showDatePicker && (
                <View 
                  style={[
                    { 
                      transform: [{ scale: calendarScale }], 
                      transformOrigin: 'top left',
                      backgroundColor: '#0a0e18',
                      borderColor: 'rgba(255, 255, 255, 0.07)',
                      shadowColor: '#000000',
                      shadowOffset: { width: 0, height: 16 },
                      shadowOpacity: 0.7,
                      shadowRadius: 32,
                    } as any,
                    Platform.OS === 'web' ? ({
                      boxShadow: '0 24px 50px -6px rgba(0, 0, 0, 0.85), inset 0 1px 0 0 rgba(255, 255, 255, 0.1), 0 0 24px -2px rgba(59, 130, 246, 0.06)',
                    } as any) : undefined
                  ]}
                  className="absolute top-[66px] left-0 w-[280px] max-w-[90vw] rounded-[24px] shadow-2xl border p-4.5 z-50"
                >
                  <SimpleCalendar tempStart={tempStart} setTempStart={setTempStart} tempEnd={tempEnd} setTempEnd={setTempEnd} />
                  
                  <View className="flex-col gap-2 mb-3">
                    <TextInput 
                      value={tempStart} 
                      onChangeText={setTempStart} 
                      placeholder="Start Date (YYYY-MM-DD)" 
                      placeholderTextColor="#6b7280" 
                      className="w-full bg-[#060910] border border-white/[0.06] p-2.5 text-xs rounded-xl text-white" 
                    />
                    <TextInput 
                      value={tempEnd} 
                      onChangeText={setTempEnd} 
                      placeholder="End Date (YYYY-MM-DD)" 
                      placeholderTextColor="#6b7280" 
                      className="w-full bg-[#060910] border border-white/[0.06] p-2.5 text-xs rounded-xl text-white" 
                    />
                  </View>

                  <View className="flex-row justify-between border-t border-white/[0.06] pt-3 mt-1">
                    <Pressable onPress={clearDateFilter} className="px-3.5 py-1.5 bg-white/[0.06] rounded-xl active:bg-white/[0.1]">
                      <Text className="text-gray-300 text-xs font-bold">Clear</Text>
                    </Pressable>
                    <View className="flex-row gap-2">
                      <Pressable onPress={() => setShowDatePicker(false)} className="px-3.5 py-1.5 rounded-xl">
                        <Text className="text-gray-500 text-xs font-bold">Cancel</Text>
                      </Pressable>
                      <Pressable onPress={applyDateFilter} className="bg-blue-600 px-4 py-1.5 rounded-xl active:bg-blue-500 shadow-sm shadow-blue-500/30">
                        <Text className="text-white text-xs font-bold">Apply</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              )}
            </View>

            <Pressable 
              onPress={() => {
                if (selectedIds.size > 0) {
                  setSelectedIds(new Set());
                } else {
                  setSelectedIds(new Set(entries.map(e => e.entry_id || e.id)));
                }
              }}
              style={[
                {
                  flex: isMobile ? 1 : undefined,
                  width: isMobile ? undefined : 'auto',
                  height: 58,
                  backgroundColor: selectedIds.size > 0 ? '#121c33' : '#0d121d',
                  borderColor: selectedIds.size > 0 ? 'rgba(59, 130, 246, 0.45)' : 'rgba(255, 255, 255, 0.06)',
                  shadowColor: selectedIds.size > 0 ? '#3b82f6' : '#000000',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: selectedIds.size > 0 ? 0.3 : 0.45,
                  shadowRadius: 16,
                  elevation: 4,
                },
                Platform.OS === 'web' ? ({
                  boxShadow: selectedIds.size > 0
                    ? '0 10px 28px -4px rgba(0, 0, 0, 0.6), 0 0 24px -2px rgba(59, 130, 246, 0.35), inset 0 1px 1px 0 rgba(147, 197, 253, 0.25)'
                    : '0 10px 28px -4px rgba(0, 0, 0, 0.55), inset 0 1px 0 0 rgba(255, 255, 255, 0.08), 0 0 18px -2px rgba(59, 130, 246, 0.08)',
                } as any) : undefined
              ]}
              className="flex-row items-center justify-center border px-5 h-[58px] rounded-2xl active:bg-[#111728]"
            >
              <SymbolView 
                name={{ 
                  ios: selectedIds.size > 0 ? 'checkmark.circle.fill' : 'checkmark.circle', 
                  android: selectedIds.size > 0 ? 'check_circle' : 'check_circle_outline', 
                  web: selectedIds.size > 0 ? 'check_circle' : 'check_circle_outline' 
                } as any} 
                tintColor={selectedIds.size > 0 ? '#3b82f6' : '#9ca3af'} 
                size={19} 
              />
              <Text className={`ml-2.5 text-sm sm:text-base font-bold ${selectedIds.size > 0 ? 'text-blue-400' : 'text-gray-200'}`}>
                {selectedIds.size > 0 ? 'Deselect All' : 'Select All'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Content Area */}
        {loading && !refreshing && entries.length === 0 ? (
          <View className="items-center justify-center mt-20">
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : entries.length === 0 ? (
          <View className="items-center justify-center mt-20">
            <Text className="text-gray-400">
              {isSearching ? "No matching entries found." : "Your journal is empty."}
            </Text>
          </View>
        ) : (
          <View className="relative w-full pt-2 sm:pt-0">
            <View 
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 32,
              }}
              className="w-full"
            >
              {entries.map((item, index) => (
                <React.Fragment key={item.id || item.entry_id}>
                  {renderItem({ item, index })}
                </React.Fragment>
              ))}
            </View>
            {loading && !refreshing && (
              <View className="absolute inset-0 bg-black/50 items-center justify-center z-50">
                <ActivityIndicator size="large" color="#3b82f6" />
              </View>
            )}
          </View>
        )}
        </View>
      </ScrollView>

      {/* Bulk Action Modal */}
      <Modal visible={!!confirmAction} transparent={true} animationType="fade">
        <View className="flex-1 bg-black/80 items-center justify-center p-4">
          <View 
            style={[
              {
                backgroundColor: '#0a0e18',
                borderColor: 'rgba(255, 255, 255, 0.07)',
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 16 },
                shadowOpacity: 0.75,
                shadowRadius: 36,
                elevation: 8,
              },
              Platform.OS === 'web' ? ({
                boxShadow: '0 28px 64px -8px rgba(0, 0, 0, 0.9), inset 0 1px 0 0 rgba(255, 255, 255, 0.1), 0 0 24px -2px rgba(59, 130, 246, 0.08)',
              } as any) : undefined
            ]}
            className="w-full max-w-sm rounded-[24px] p-6 shadow-2xl border"
          >
            <Text className="text-xl font-bold text-white mb-2 text-center">
              {confirmAction === 'delete' ? 'Delete Entries' : 'Export Entries'}
            </Text>
            <Text className="text-gray-400 mb-6 text-center leading-relaxed">
              {confirmAction === 'delete' 
                ? `Are you sure you want to permanently delete ${selectedIds.size} ${selectedIds.size === 1 ? 'entry' : 'entries'}? This action cannot be undone.`
                : `How would you like to export your ${selectedIds.size} selected ${selectedIds.size === 1 ? 'entry' : 'entries'}?`
              }
            </Text>
            
            {confirmAction === 'delete' ? (
              <View className="flex-row gap-3">
                <Pressable onPress={() => setConfirmAction(null)} className="flex-1 bg-slate-800/80 py-3 rounded-xl active:bg-slate-700">
                  <Text className="text-center font-bold text-gray-300">Cancel</Text>
                </Pressable>
                
                <Pressable onPress={executeBulkAction} className="flex-1 bg-red-500 py-3 rounded-xl active:bg-red-600 shadow-sm shadow-red-500/20">
                  <Text className="text-center font-bold text-white">Delete</Text>
                </Pressable>
              </View>
            ) : (
              <View className="flex-col gap-3">
                <Pressable onPress={executeBulkAction} className="w-full bg-blue-600 py-3.5 rounded-xl active:bg-blue-500 shadow-sm shadow-blue-500/20">
                  <Text className="text-center font-bold text-white">Generate PDF Document</Text>
                </Pressable>

                <Pressable onPress={executeBulkExportClipboard} className="w-full bg-slate-800/80 border border-white/[0.08] py-3.5 rounded-xl active:bg-slate-700">
                  <Text className="text-center font-bold text-white">Copy Text to Clipboard</Text>
                </Pressable>

                <Pressable onPress={() => setConfirmAction(null)} className="w-full bg-slate-800/50 py-3.5 mt-2 rounded-xl active:bg-slate-700">
                  <Text className="text-center font-bold text-gray-400">Cancel</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Single Entry Reading Modal */}
      <ResponsiveModal visible={!!selectedEntryToRead}>
        {selectedEntryToRead && (
            <View 
              style={[
                {
                  backgroundColor: '#0a0e18',
                  borderColor: 'rgba(255, 255, 255, 0.07)',
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 20 },
                  shadowOpacity: 0.8,
                  shadowRadius: 40,
                  elevation: 10,
                },
                Platform.OS === 'web' ? ({
                  boxShadow: '0 32px 72px -8px rgba(0, 0, 0, 0.95), inset 0 1px 0 0 rgba(255, 255, 255, 0.1), 0 0 32px -4px rgba(59, 130, 246, 0.1)',
                } as any) : undefined
              ]}
              className="w-full max-w-2xl flex-1 max-h-[90%] sm:max-h-[85%] rounded-[24px] shadow-2xl border overflow-hidden"
            >
              <View className="flex-row justify-between items-center p-5 border-b border-white/[0.08]">
                <View className="flex-row gap-3">
                  <Pressable 
                    onPress={() => generateExport([selectedEntryToRead])} 
                    style={[
                      Platform.OS === 'web' ? { filter: 'drop-shadow(0px 0px 8px rgba(59, 130, 246, 0.5))' } as any : { shadowColor: '#3b82f6', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }
                    ]} 
                    className="flex-row items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] active:opacity-50"
                  >
                    <SymbolView name={{ ios: 'square.and.arrow.up', android: 'ios_share', web: 'ios_share' } as any} tintColor="#ffffff" size={16} />
                    <Text style={{ color: '#ffffff' }} className="text-xs font-bold uppercase tracking-wider hidden sm:flex">Export</Text>
                  </Pressable>
                  <Pressable 
                    onPress={() => deleteSingleEntry(selectedEntryToRead)} 
                    style={[
                      Platform.OS === 'web' ? { filter: 'drop-shadow(0px 0px 8px rgba(239, 68, 68, 0.5))' } as any : { shadowColor: '#ef4444', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }
                    ]} 
                    className="flex-row items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] active:opacity-50"
                  >
                    <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' } as any} tintColor="#ef4444" size={16} />
                    <Text style={{ color: '#ef4444' }} className="text-xs font-bold uppercase tracking-wider hidden sm:flex">Delete</Text>
                  </Pressable>
                  <View className="relative">
                    <Pressable 
                      onPress={askPrivateLLM} 
                      {...(Platform.OS === 'web' ? { 
                        onHoverIn: () => !hasModel && setShowAiTooltip(true),
                        onHoverOut: () => setShowAiTooltip(false) 
                      } as any : {})}
                      style={[
                        Platform.OS === 'web' ? { filter: 'drop-shadow(0px 0px 8px rgba(59, 130, 246, 0.5))' } as any : { shadowColor: '#3b82f6', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
                        !hasModel && { opacity: 0.5 }
                      ]} 
                      className="flex-row items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/30 active:opacity-50 ml-2"
                    >
                      <SymbolView name={{ ios: 'brain.head.profile', android: 'psychology', web: 'psychology' } as any} tintColor="#3b82f6" size={16} />
                      <Text style={{ color: '#3b82f6' }} className="text-xs font-bold uppercase tracking-wider hidden sm:flex">Ask Private AI</Text>
                    </Pressable>
                    
                    {Platform.OS === 'web' && showAiTooltip && !hasModel && (
                      <View 
                        className="absolute top-full mt-2 right-0 px-3 py-2 rounded-sm shadow-2xl w-64 z-50 border border-gray-700"
                        style={{ backgroundColor: '#000000', opacity: 1, zIndex: 9999 }}
                      >
                        <Text style={{ color: '#ffffff', opacity: 1 }} className="text-xs text-center font-medium">You need to download the private LLM locally first to use this</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Pressable 
                  onPress={() => {
                    setSelectedEntryToRead(null);
                    setShowChat(false);
                    setChatHistory([]);
                  }} 
                  style={[
                    Platform.OS === 'web' ? { filter: 'drop-shadow(0px 0px 8px rgba(59, 130, 246, 0.5))' } as any : { shadowColor: '#3b82f6', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }
                  ]} 
                  className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] active:opacity-50"
                >
                  <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' } as any} tintColor="#3b82f6" size={16} />
                </Pressable>
              </View>
              
              <ScrollView ref={scrollViewRef} className="flex-1 p-6" showsVerticalScrollIndicator={true}>
                <View className="flex-row items-center gap-2 mb-6">
                  <View style={[Platform.OS === 'web' ? { filter: 'drop-shadow(0px 0px 8px rgba(59, 130, 246, 0.8))' } as any : { shadowColor: '#3b82f6', shadowOpacity: 0.8, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }]}>
                    <SymbolView 
                      name={selectedEntryToRead.entry_type === 'voice' ? { ios: 'waveform', android: 'graphic_eq', web: 'graphic_eq' } as any : { ios: 'doc.text.fill', android: 'description', web: 'description' } as any} 
                      tintColor="#3b82f6" 
                      size={20} 
                    />
                  </View>
                  <Text className="text-gray-400 font-bold uppercase tracking-wider text-xs">
                    {new Date(selectedEntryToRead.created_at).toLocaleDateString()} at {new Date(selectedEntryToRead.created_at).toLocaleTimeString()}
                  </Text>
                </View>
                <Text className="text-gray-100 text-lg leading-loose pb-12">
                  {selectedEntryToRead.fullContent || selectedEntryToRead.content}
                </Text>

                {showChat && (
                    <View className="mt-8 pt-6 border-t border-gray-800 pb-4">
                      <View className="flex-row items-center gap-2 mb-6">
                        <View style={[Platform.OS === 'web' ? { filter: 'drop-shadow(0px 0px 8px rgba(59, 130, 246, 0.5))' } as any : { shadowColor: '#3b82f6', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }]}>
                          <SymbolView name={{ ios: 'brain.head.profile', android: 'psychology', web: 'psychology' } as any} tintColor="#3b82f6" size={20} />
                        </View>
                        <Text style={{ textShadowColor: 'rgba(59, 130, 246, 0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }} className="text-blue-500 font-bold uppercase tracking-widest text-xs">Private AI Chat</Text>
                      </View>
                      
                      {chatHistory.map((msg, index) => {
                        if (msg.role === 'assistant' && !msg.content) return null;
                        return (
                          <View key={index} className={`mb-4 max-w-[85%] ${msg.role === 'user' ? 'self-end' : 'self-start'}`}>
                            <View className={`p-4 rounded-sm ${msg.role === 'user' ? 'bg-blue-500' : 'bg-gray-800'}`} style={msg.role === 'user' ? [Platform.OS === 'web' ? { filter: 'drop-shadow(0px 0px 8px rgba(59, 130, 246, 0.5))' } as any : { shadowColor: '#3b82f6', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }] : []}>
                              <Text className={`${msg.role === 'user' ? 'text-white' : 'text-white'} text-base leading-relaxed`}>
                                {msg.content}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                      
                      {isChatThinking && (
                        <View className="mb-4 self-start max-w-[85%]">
                          <View className="p-4 rounded-sm bg-gray-800 flex-row items-center gap-3">
                            <View style={[Platform.OS === 'web' ? { filter: 'drop-shadow(0px 0px 8px rgba(59, 130, 246, 0.5))' } as any : { shadowColor: '#3b82f6', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }]}>
                              <ActivityIndicator size="small" color="#3b82f6" />
                            </View>
                            <Text style={{ textShadowColor: 'rgba(59, 130, 246, 0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }} className="text-blue-500 text-sm font-bold uppercase tracking-wider">{chatLoadingText}</Text>
                          </View>
                        </View>
                      )}
                    </View>
                )}
              </ScrollView>
              
              {showChat && (
                <View className="p-4 border-t border-gray-800 bg-gray-900 z-50">
                  <View className="flex-row">
                    <TextInput 
                      className="flex-1 bg-black border border-gray-800 rounded-sm px-4 py-3 text-white text-base min-h-[48px]"
                      placeholder="Ask about this entry..."
                      placeholderTextColor="#6b7280"
                      value={chatInput}
                      onChangeText={setChatInput}
                      editable={!isChatThinking}
                      multiline
                      maxLength={500}
                    />
                    <Pressable 
                      onPress={sendMessageToLLM}
                      disabled={isChatThinking || !chatInput.trim()}
                      className={`ml-3 justify-center items-center px-5 rounded-sm ${!chatInput.trim() || isChatThinking ? 'bg-gray-800' : 'bg-blue-500 active:bg-blue-600'}`}
                      style={(!chatInput.trim() || isChatThinking) ? [] : [Platform.OS === 'web' ? { filter: 'drop-shadow(0px 0px 8px rgba(59, 130, 246, 0.5))' } as any : { shadowColor: '#3b82f6', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }]}
                    >
                      <SymbolView name={{ ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' } as any} tintColor={!chatInput.trim() || isChatThinking ? '#9ca3af' : 'white'} size={20} />
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
        )}
      </ResponsiveModal>


    </SafeAreaView>
  );
}
