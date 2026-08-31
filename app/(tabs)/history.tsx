import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, TextInput, Pressable, SafeAreaView, Keyboard, Alert, Modal, Platform, ScrollView, useWindowDimensions } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useFocusEffect } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { getUserEntries, searchEntries, deleteEntries, Entry } from '../../src/services/entries';
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
        <Pressable onPress={prevMonth} className="p-1"><Text className="dark:text-white font-bold">&lt;</Text></Pressable>
        <Text className="dark:text-white font-bold text-xs uppercase tracking-widest">
          {baseDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </Text>
        <Pressable onPress={nextMonth} className="p-1"><Text className="dark:text-white font-bold">&gt;</Text></Pressable>
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
          let textClass = "text-gray-900 dark:text-gray-300";
          
          if (isStart || isEnd) {
            bgClass = "bg-blue-500 rounded-sm";
            textClass = "text-white font-bold";
          } else if (isBetween) {
            bgClass = "bg-blue-500/20";
            textClass = "text-blue-600 dark:text-blue-400";
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

export default function HistoryScreen() {
  const { height, width } = useWindowDimensions();
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

  // Single Reading Modal
  const [selectedEntryToRead, setSelectedEntryToRead] = useState<any>(null);

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
    }, [user])
  );

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchContent();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [startDate, endDate, query]);

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

    return (
      <Pressable
        onPress={() => setSelectedEntryToRead(item)}
        onLongPress={() => toggleBulkSelection(actualId)}
        className={`bg-white dark:bg-gray-900 p-4 rounded-sm shadow-sm border mb-4 ${
          isSelected ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20' : 'border-gray-100 dark:border-gray-800'
        }`}
      >
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-row items-center gap-2 flex-wrap flex-1 pr-2">
            {isSearchResult && (
              <View className="bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded mr-1">
                <Text className="text-blue-600 dark:text-blue-400 font-bold text-xs">
                  #{item.finalRank} most relevant
                </Text>
              </View>
            )}
            <View className="flex-row items-center gap-1">
              <SymbolView 
                name={item.entry_type === 'voice' ? { ios: 'mic.fill', android: 'mic', web: 'mic' } as any : { ios: 'doc.text.fill', android: 'description', web: 'description' } as any} 
                tintColor="#9ca3af" 
                size={16} 
              />
              <Text className="text-gray-400 dark:text-gray-500 font-medium text-xs">
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>

          <Pressable onPress={() => toggleBulkSelection(actualId)} className="p-1 -mt-1 -mr-1 active:opacity-50">
            <SymbolView 
              name={isSelected ? { ios: 'checkmark.square.fill', android: 'check_box', web: 'check_box' } as any : { ios: 'square', android: 'check_box_outline_blank', web: 'check_box_outline_blank' } as any} 
              tintColor={isSelected ? '#3b82f6' : '#4b5563'} 
              size={22} 
            />
          </Pressable>
        </View>
        
        <Text className="text-gray-800 dark:text-gray-200 text-base leading-relaxed" numberOfLines={4}>
          {displayText}
        </Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-black">
      <View className="flex-1 p-4">
        
        {/* Top Header / Action Bar */}
        {selectedIds.size > 0 ? (
          <View className="flex-row items-center justify-between bg-transparent p-3 mb-4 mt-8">
            <Text className="text-gray-900 dark:text-gray-100 font-bold text-lg tracking-wider">
              {selectedIds.size} SELECTED
            </Text>
            <View className="flex-row gap-4">
              <Pressable 
                onPress={() => setSelectedIds(new Set())} 
                className="flex-row items-center gap-2 active:opacity-50"
              >
                <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' } as any} tintColor="#6b7280" size={16} />
                <Text className="text-gray-600 dark:text-gray-400 text-xs font-bold uppercase tracking-wider hidden sm:flex">Deselect All</Text>
              </Pressable>
              <Pressable 
                onPress={confirmBulkExport} 
                className="flex-row items-center gap-2 active:opacity-50"
              >
                <SymbolView name={{ ios: 'square.and.arrow.up', android: 'ios_share', web: 'ios_share' } as any} tintColor="#6b7280" size={16} />
                <Text className="text-gray-600 dark:text-gray-400 text-xs font-bold uppercase tracking-wider hidden sm:flex">Export</Text>
              </Pressable>
              <Pressable 
                onPress={confirmBulkDelete} 
                className="flex-row items-center gap-2 active:opacity-50"
              >
                <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' } as any} tintColor="#6b7280" size={16} />
                <Text className="text-gray-600 dark:text-gray-400 text-xs font-bold uppercase tracking-wider hidden sm:flex">Delete</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View className="flex-row items-center bg-white dark:bg-gray-900 p-2 rounded-sm border border-gray-200 dark:border-gray-800 shadow-sm mb-3 mt-8">
              <TextInput
                className="flex-1 px-4 py-2 text-base dark:text-white"
                placeholder="Search for specific journals"
                placeholderTextColor="#9ca3af"
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
              />
              {query.trim().length > 0 && (
                <Pressable onPress={() => { setQuery(''); Keyboard.dismiss(); }} className="p-2">
                  <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' } as any} tintColor="#9ca3af" size={20} />
                </Pressable>
              )}
            </View>

              <View className="flex-row mb-4 items-center justify-between relative z-10 w-full">
                <View className="flex-row items-center gap-3">
                  <View className="relative z-20">
                    <Pressable 
                      onPress={() => setShowDatePicker(true)}
                      className={`flex-row items-center bg-gray-200 dark:bg-gray-800 px-3 py-2 rounded-sm gap-2 ${(startDate || endDate) ? 'bg-blue-100 dark:bg-blue-900/50' : ''}`}
                    >
                      <SymbolView name={{ ios: 'calendar', android: 'calendar_today', web: 'calendar_today' } as any} tintColor={(startDate || endDate) ? '#3b82f6' : '#9ca3af'} size={14} />
                      <Text className={`text-xs font-semibold ${(startDate || endDate) ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
                        {(startDate || endDate) ? 'Filtered' : 'Date Range'}
                      </Text>
                    </Pressable>
                    
                    {/* Popover Calendar */}
                    {showDatePicker && (
                      <View 
                        style={{ 
                          transform: [{ scale: calendarScale }], 
                          transformOrigin: 'top left' 
                        } as any}
                        className="absolute top-10 left-0 w-[280px] bg-white dark:bg-gray-900 rounded-sm shadow-xl border border-gray-200 dark:border-gray-800 p-3 z-50"
                      >
                        <SimpleCalendar tempStart={tempStart} setTempStart={setTempStart} tempEnd={tempEnd} setTempEnd={setTempEnd} />
                        
                        <View className="flex-col gap-2 mb-3">
                          <TextInput 
                            value={tempStart} 
                            onChangeText={setTempStart} 
                            placeholder="Start Date (YYYY-MM-DD)" 
                            placeholderTextColor="#9ca3af" 
                            className="w-full bg-gray-100 dark:bg-gray-800 p-2 text-xs rounded-sm dark:text-white" 
                          />
                          <TextInput 
                            value={tempEnd} 
                            onChangeText={setTempEnd} 
                            placeholder="End Date (YYYY-MM-DD)" 
                            placeholderTextColor="#9ca3af" 
                            className="w-full bg-gray-100 dark:bg-gray-800 p-2 text-xs rounded-sm dark:text-white" 
                          />
                        </View>

                        <View className="flex-row justify-between border-t border-gray-100 dark:border-gray-800 pt-3 mt-1">
                          <Pressable onPress={clearDateFilter} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-sm">
                            <Text className="text-gray-600 dark:text-gray-300 text-xs font-bold">Clear</Text>
                          </Pressable>
                          <View className="flex-row gap-2">
                            <Pressable onPress={() => setShowDatePicker(false)} className="px-3 py-1.5 rounded-sm">
                              <Text className="text-gray-500 text-xs font-bold">Cancel</Text>
                            </Pressable>
                            <Pressable onPress={applyDateFilter} className="bg-blue-500 px-3 py-1.5 rounded-sm">
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
                    className={`flex-row items-center bg-gray-200 dark:bg-gray-800 px-3 py-2 rounded-sm gap-2 ${selectedIds.size > 0 ? 'bg-blue-100 dark:bg-blue-900/50' : ''}`}
                  >
                    <SymbolView name={{ ios: selectedIds.size > 0 ? 'checkmark.circle.fill' : 'checkmark.circle', android: 'check_circle', web: 'check_circle' } as any} tintColor={selectedIds.size > 0 ? '#3b82f6' : '#9ca3af'} size={14} />
                    <Text className={`text-xs font-semibold ${selectedIds.size > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
                      {selectedIds.size > 0 ? 'Deselect All' : 'Select All'}
                    </Text>
                  </Pressable>
                </View>
              </View>
          </>
        )}
        
        {loading && !refreshing && entries.length === 0 ? (
          <View className="flex-1 items-center justify-center -z-10">
            <ActivityIndicator size="large" />
          </View>
        ) : entries.length === 0 ? (
          <View className="flex-1 items-center justify-center -z-10">
            <Text className="text-gray-500 dark:text-gray-400">
              {isSearching ? "No matching entries found." : "Your journal is empty."}
            </Text>
          </View>
        ) : (
          <View className="flex-1 -z-10 relative">
            <FlatList
              data={entries}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            />
            {loading && !refreshing && (
              <View className="absolute inset-0 bg-white/50 dark:bg-black/50 items-center justify-center z-50">
                <ActivityIndicator size="large" />
              </View>
            )}
          </View>
        )}
      </View>

      {/* Bulk Action Modal */}
      <Modal visible={!!confirmAction} transparent={true} animationType="fade">
        <View className="flex-1 bg-black/60 items-center justify-center p-4">
          <View className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-sm p-6 shadow-xl">
            <Text className="text-xl font-bold text-gray-900 dark:text-white mb-2 text-center">
              {confirmAction === 'delete' ? 'Delete Entries' : 'Export Entries'}
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 mb-6 text-center leading-relaxed">
              {confirmAction === 'delete' 
                ? `Are you sure you want to permanently delete ${selectedIds.size} ${selectedIds.size === 1 ? 'entry' : 'entries'}? This action cannot be undone.`
                : `How would you like to export your ${selectedIds.size} selected ${selectedIds.size === 1 ? 'entry' : 'entries'}?`
              }
            </Text>
            
            {confirmAction === 'delete' ? (
              <View className="flex-row gap-3">
                <Pressable onPress={() => setConfirmAction(null)} className="flex-1 bg-gray-100 dark:bg-gray-800 py-3 rounded-sm active:bg-gray-200 dark:active:bg-gray-700">
                  <Text className="text-center font-bold text-gray-700 dark:text-gray-300">Cancel</Text>
                </Pressable>
                
                <Pressable onPress={executeBulkAction} className="flex-1 bg-red-500 py-3 rounded-sm active:bg-red-600 shadow-sm shadow-red-500/20">
                  <Text className="text-center font-bold text-white">Delete</Text>
                </Pressable>
              </View>
            ) : (
              <View className="flex-col gap-3">
                <Pressable onPress={executeBulkAction} className="w-full bg-blue-500 py-3.5 rounded-sm active:bg-blue-600 shadow-sm shadow-blue-500/20">
                  <Text className="text-center font-bold text-white">Generate PDF Document</Text>
                </Pressable>

                <Pressable onPress={executeBulkExportClipboard} className="w-full bg-gray-800 dark:bg-gray-700 py-3.5 rounded-sm active:bg-gray-900">
                  <Text className="text-center font-bold text-white">Copy Text to Clipboard</Text>
                </Pressable>

                <Pressable onPress={() => setConfirmAction(null)} className="w-full bg-gray-100 dark:bg-gray-800 py-3.5 mt-2 rounded-sm active:bg-gray-200 dark:active:bg-gray-700">
                  <Text className="text-center font-bold text-gray-700 dark:text-gray-300">Cancel</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Single Entry Reading Modal */}
      <Modal visible={!!selectedEntryToRead} animationType="fade" transparent={true}>
        {selectedEntryToRead && (
          <View className="flex-1 bg-black/60 items-center justify-center p-4">
            <View className="w-full max-w-2xl max-h-[90%] bg-white dark:bg-gray-900 rounded-sm shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <View className="flex-row justify-between items-center p-5 border-b border-gray-100 dark:border-gray-800">
                <View className="flex-row gap-3">
                  <Pressable 
                    onPress={() => generateExport([selectedEntryToRead])} 
                    style={[
                      Platform.OS === 'web' ? { filter: 'drop-shadow(0px 0px 8px rgba(59, 130, 246, 0.5))' } as any : { shadowColor: '#3b82f6', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }
                    ]} 
                    className="flex-row items-center gap-2 px-3 py-2 rounded-sm active:opacity-50"
                  >
                    <SymbolView name={{ ios: 'square.and.arrow.up', android: 'ios_share', web: 'ios_share' } as any} tintColor="#3b82f6" size={16} />
                    <Text style={{ color: '#3b82f6' }} className="text-xs font-bold uppercase tracking-wider">Export</Text>
                  </Pressable>
                  <Pressable 
                    onPress={() => deleteSingleEntry(selectedEntryToRead)} 
                    style={[
                      Platform.OS === 'web' ? { filter: 'drop-shadow(0px 0px 8px rgba(59, 130, 246, 0.5))' } as any : { shadowColor: '#3b82f6', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }
                    ]} 
                    className="flex-row items-center gap-2 px-3 py-2 rounded-sm active:opacity-50"
                  >
                    <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' } as any} tintColor="#3b82f6" size={16} />
                    <Text style={{ color: '#3b82f6' }} className="text-xs font-bold uppercase tracking-wider">Delete</Text>
                  </Pressable>
                </View>
                <Pressable 
                  onPress={() => setSelectedEntryToRead(null)} 
                  style={[
                    Platform.OS === 'web' ? { filter: 'drop-shadow(0px 0px 8px rgba(59, 130, 246, 0.5))' } as any : { shadowColor: '#3b82f6', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }
                  ]} 
                  className="p-2 rounded-sm active:opacity-50"
                >
                  <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' } as any} tintColor="#3b82f6" size={16} />
                </Pressable>
              </View>
              
              <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={true}>
                <View className="flex-row items-center gap-2 mb-6">
                  <View style={[Platform.OS === 'web' ? { filter: 'drop-shadow(0px 0px 8px rgba(59, 130, 246, 0.8))' } as any : { shadowColor: '#3b82f6', shadowOpacity: 0.8, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }]}>
                    <SymbolView 
                      name={selectedEntryToRead.entry_type === 'voice' ? { ios: 'waveform', android: 'graphic_eq', web: 'graphic_eq' } as any : { ios: 'doc.text.fill', android: 'description', web: 'description' } as any} 
                      tintColor="#3b82f6" 
                      size={20} 
                    />
                  </View>
                  <Text className="text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider text-xs">
                    {new Date(selectedEntryToRead.created_at).toLocaleDateString()} at {new Date(selectedEntryToRead.created_at).toLocaleTimeString()}
                  </Text>
                </View>
                <Text className="text-gray-900 dark:text-gray-100 text-lg leading-loose pb-12">
                  {selectedEntryToRead.fullContent || selectedEntryToRead.content}
                </Text>
              </ScrollView>
            </View>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}
