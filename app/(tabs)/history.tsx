import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, TextInput, Pressable, SafeAreaView, Keyboard, Alert, Modal, Platform } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useFocusEffect } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { getUserEntries, searchEntries, deleteEntries, Entry } from '../../src/services/entries';
import { useAuth } from '../../src/providers/AuthProvider';

type FilterType = 'all' | 'text' | 'voice';
type FilterTime = 'all' | 'week' | 'month' | 'year';

export default function HistoryScreen() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');
  
  // Filters
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterTime, setFilterTime] = useState<FilterTime>('all');
  
  // Selection & Modals
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'delete' | 'export' | null>(null);

  const { user } = useAuth();

  const getStartDate = (time: FilterTime): string | undefined => {
    if (time === 'all') return undefined;
    const d = new Date();
    if (time === 'week') d.setDate(d.getDate() - 7);
    if (time === 'month') d.setMonth(d.getMonth() - 1);
    if (time === 'year') d.setFullYear(d.getFullYear() - 1);
    return d.toISOString();
  };

  const fetchContent = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const typeParam = filterType === 'all' ? undefined : filterType;
      const dateParam = getStartDate(filterTime);

      if (query.trim().length > 0) {
        setIsSearching(true);
        const data = await searchEntries(query.trim(), typeParam, dateParam);
        setEntries(data);
      } else {
        setIsSearching(false);
        const data = await getUserEntries(typeParam, dateParam);
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
  }, [filterType, filterTime, query]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchContent();
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const confirmDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmAction('delete');
  };

  const confirmExport = () => {
    if (selectedIds.size === 0) return;
    setConfirmAction('export');
  };

  const executeAction = async () => {
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
      }
    } else if (confirmAction === 'export') {
      try {
        setLoading(true);
        const entriesToExport = entries.filter(e => selectedIds.has(e.entry_id || e.id));
        
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
        setSelectedIds(new Set());
      } catch (err) {
        console.error("Export failed:", err);
        Alert.alert('Error', 'Failed to generate PDF.');
      } finally {
        setLoading(false);
      }
    }
    setConfirmAction(null);
  };

  const executeExportClipboard = async () => {
    try {
      const entriesToExport = entries.filter(e => selectedIds.has(e.entry_id || e.id));
      
      let textContent = ``;

      entriesToExport.forEach((entry, idx) => {
        const date = new Date(entry.created_at);
        const type = entry.entry_type === 'voice' ? '🎤 Voice Entry' : '✍️ Text Entry';
        
        textContent += `${date.toLocaleDateString()} at ${date.toLocaleTimeString()}\n`;
        textContent += `${type}\n\n`;
        textContent += `${entry.fullContent || entry.content}\n\n`;
        
        if (idx < entriesToExport.length - 1) {
          textContent += `----------------------------------------\n\n`;
        }
      });

      await Clipboard.setStringAsync(textContent);
      Alert.alert('Success', 'Entries copied to clipboard!');
      setConfirmAction(null);
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Clipboard export failed:", err);
      Alert.alert('Error', 'Failed to copy to clipboard.');
    }
  };

  const renderHighlightedContent = (fullText: string, chunkText: string) => {
    const trimmedChunk = chunkText.trim();
    if (!trimmedChunk || !fullText.includes(trimmedChunk)) {
      return <Text className="text-gray-800 dark:text-gray-200 text-base leading-relaxed">{fullText}</Text>;
    }
    const parts = fullText.split(trimmedChunk);
    return (
      <Text className="text-gray-800 dark:text-gray-200 text-base leading-relaxed">
        {parts.map((part, index) => (
          <React.Fragment key={index}>
            <Text>{part}</Text>
            {index < parts.length - 1 && (
              <Text className="bg-amber-200 dark:bg-amber-900/60 text-amber-950 dark:text-amber-100 font-semibold px-1 rounded">
                {trimmedChunk}
              </Text>
            )}
          </React.Fragment>
        ))}
      </Text>
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    const actualId = item.entry_id || item.id;
    const isSelected = selectedIds.has(actualId);
    const isExpanded = expandedId === actualId;
    const isSearchResult = !!item.finalRank;
    const hasFull = Boolean(item.fullContent && item.fullContent.trim().length > 0);

    return (
      <Pressable
        onPress={() => isSearchResult ? toggleExpand(actualId) : toggleSelection(actualId)}
        className={`bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-sm border mb-4 ${
          isSelected ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20' : 'border-gray-100 dark:border-gray-800'
        }`}
      >
        <View className="flex-row justify-between items-start mb-3">
          <Pressable onPress={() => toggleSelection(actualId)} className="bg-white dark:bg-gray-900 rounded-full p-1 -ml-1 -mt-1 active:bg-gray-100 dark:active:bg-gray-800">
            <SymbolView 
              name={isSelected ? { ios: 'checkmark.square.fill', android: 'check_box', web: 'check_box' } : { ios: 'square', android: 'check_box_outline_blank', web: 'check_box_outline_blank' }} 
              tintColor={isSelected ? '#3b82f6' : '#d1d5db'} 
              size={24} 
            />
          </Pressable>
          <View className="items-end shrink ml-2">
            {isSearchResult && (
              <Text className="text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded text-xs mb-1">
                #{item.finalRank}
              </Text>
            )}
            <Text className="text-gray-400 dark:text-gray-500 font-medium text-xs">
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {isExpanded && hasFull ? (
          <View>
            {renderHighlightedContent(item.fullContent, item.content)}
            <Text className="text-xs text-gray-400 dark:text-gray-500 mt-3 italic text-right">
              Tap to collapse
            </Text>
          </View>
        ) : (
          <View>
            <Text className="text-gray-800 dark:text-gray-200 text-base leading-relaxed" numberOfLines={isSearchResult ? undefined : 4}>
              {item.content}
            </Text>
            {hasFull && item.fullContent !== item.content && (
              <Text className="text-xs text-blue-500 dark:text-blue-400 mt-3 font-medium flex-row items-center">
                Tap to view full entry with highlighted snippet →
              </Text>
            )}
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-black">
      <View className="flex-1 p-4">
        
        {/* Top Header / Action Bar */}
        {selectedIds.size > 0 ? (
          <View className="flex-row items-center justify-between bg-blue-50 dark:bg-blue-900/30 p-3 rounded-2xl mb-4 border border-blue-100 dark:border-blue-900/50">
            <Text className="text-blue-800 dark:text-blue-300 font-bold text-lg">{selectedIds.size} Selected</Text>
            <View className="flex-row gap-2">
              <Pressable onPress={confirmExport} className="bg-blue-500/20 active:bg-blue-500/30 px-4 py-2 rounded-xl">
                <Text className="text-blue-600 dark:text-blue-400 font-bold">Export</Text>
              </Pressable>
              <Pressable onPress={confirmDelete} className="bg-red-500/20 active:bg-red-500/30 px-4 py-2 rounded-xl">
                <Text className="text-red-600 dark:text-red-400 font-bold">Delete</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <Text className="text-3xl font-bold mb-4 dark:text-white">Journal</Text>
            
            <View className="flex-row items-center bg-white dark:bg-gray-900 p-2 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm mb-3">
              <TextInput
                className="flex-1 px-4 py-2 text-base dark:text-white"
                placeholder="Search ideas, feelings, or past events..."
                placeholderTextColor="#9ca3af"
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
              />
              {query.trim().length > 0 && (
                <Pressable onPress={() => { setQuery(''); Keyboard.dismiss(); }} className="p-2">
                  <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} tintColor="#9ca3af" size={20} />
                </Pressable>
              )}
            </View>

            <View className="flex-row mb-4 gap-2">
              <View className="flex-row bg-gray-200 dark:bg-gray-800 rounded-xl p-1">
                <Pressable onPress={() => setFilterType('all')} className={`px-3 py-1.5 rounded-lg ${filterType === 'all' ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}>
                  <Text className={`text-xs font-semibold ${filterType === 'all' ? 'text-black dark:text-white' : 'text-gray-500'}`}>All</Text>
                </Pressable>
                <Pressable onPress={() => setFilterType('text')} className={`px-3 py-1.5 rounded-lg ${filterType === 'text' ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}>
                  <Text className={`text-xs font-semibold ${filterType === 'text' ? 'text-black dark:text-white' : 'text-gray-500'}`}>Text</Text>
                </Pressable>
                <Pressable onPress={() => setFilterType('voice')} className={`px-3 py-1.5 rounded-lg ${filterType === 'voice' ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}>
                  <Text className={`text-xs font-semibold ${filterType === 'voice' ? 'text-black dark:text-white' : 'text-gray-500'}`}>Voice</Text>
                </Pressable>
              </View>
              
              <View className="flex-row bg-gray-200 dark:bg-gray-800 rounded-xl p-1 ml-auto">
                <Pressable onPress={() => setFilterTime('all')} className={`px-3 py-1.5 rounded-lg ${filterTime === 'all' ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}>
                  <Text className={`text-xs font-semibold ${filterTime === 'all' ? 'text-black dark:text-white' : 'text-gray-500'}`}>Any</Text>
                </Pressable>
                <Pressable onPress={() => setFilterTime('month')} className={`px-3 py-1.5 rounded-lg ${filterTime === 'month' ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}>
                  <Text className={`text-xs font-semibold ${filterTime === 'month' ? 'text-black dark:text-white' : 'text-gray-500'}`}>Mo</Text>
                </Pressable>
                <Pressable onPress={() => setFilterTime('year')} className={`px-3 py-1.5 rounded-lg ${filterTime === 'year' ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}>
                  <Text className={`text-xs font-semibold ${filterTime === 'year' ? 'text-black dark:text-white' : 'text-gray-500'}`}>Yr</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}
        
        {loading && !refreshing && entries.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#888" />
          </View>
        ) : entries.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-gray-500 dark:text-gray-400">
              {isSearching ? "No matching entries found." : "Your journal is empty."}
            </Text>
          </View>
        ) : (
          <FlatList
            data={entries}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        )}
      </View>

      {/* Custom Confirmation Modal */}
      <Modal
        visible={!!confirmAction}
        transparent={true}
        animationType="fade"
      >
        <View className="flex-1 bg-black/50 items-center justify-center p-4">
          <View className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-3xl p-6 shadow-xl">
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
                <Pressable 
                  onPress={() => setConfirmAction(null)} 
                  className="flex-1 bg-gray-100 dark:bg-gray-800 py-3 rounded-xl active:bg-gray-200 dark:active:bg-gray-700"
                >
                  <Text className="text-center font-bold text-gray-700 dark:text-gray-300">Cancel</Text>
                </Pressable>
                
                <Pressable 
                  onPress={executeAction} 
                  className="flex-1 bg-red-500 py-3 rounded-xl active:bg-red-600"
                >
                  <Text className="text-center font-bold text-white">Delete</Text>
                </Pressable>
              </View>
            ) : (
              <View className="flex-col gap-3">
                <Pressable 
                  onPress={executeAction} 
                  className="w-full bg-blue-500 py-3 rounded-xl active:bg-blue-600 flex-row justify-center items-center gap-2"
                >
                  <SymbolView name={{ ios: 'doc.richtext.fill', android: 'picture_as_pdf', web: 'picture_as_pdf' }} tintColor="white" size={18} />
                  <Text className="text-center font-bold text-white">Generate PDF Document</Text>
                </Pressable>

                <Pressable 
                  onPress={executeExportClipboard} 
                  className="w-full bg-gray-800 dark:bg-gray-700 py-3 rounded-xl active:bg-gray-700 dark:active:bg-gray-600 flex-row justify-center items-center gap-2"
                >
                  <SymbolView name={{ ios: 'doc.on.clipboard.fill', android: 'content_copy', web: 'content_copy' }} tintColor="white" size={18} />
                  <Text className="text-center font-bold text-white">Copy Text to Clipboard</Text>
                </Pressable>

                <Pressable 
                  onPress={() => setConfirmAction(null)} 
                  className="w-full bg-gray-100 dark:bg-gray-800 py-3 rounded-xl mt-2 active:bg-gray-200 dark:active:bg-gray-700"
                >
                  <Text className="text-center font-bold text-gray-700 dark:text-gray-300">Cancel</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
