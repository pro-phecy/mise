import { useEffect, useRef, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Alert, Dimensions, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text as NativeText, TextInput as NativeTextInput, useWindowDimensions, View } from 'react-native';
import type { ComponentProps, StyleProp, TextStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ResponsiveIonicons as Icon } from '../components/ResponsiveUI';
import { colors } from '../theme';

export type MiseChatMessage = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string };

type Props = {
  messages: MiseChatMessage[];
  onBack: () => void;
  onMessagesChange: (messages: MiseChatMessage[]) => void;
  onSendMessage: (messages: Array<Pick<MiseChatMessage, 'role' | 'content'>>) => Promise<string>;
  onSyncMessages: () => Promise<number>;
  onClearConversation: () => Promise<void>;
  onOpenAccount: () => void;
};

type ChatTextProps = ComponentProps<typeof NativeText> & { layoutScale: number };
type ChatInputProps = ComponentProps<typeof NativeTextInput> & { layoutScale: number };

function scaleTextStyle(style: StyleProp<TextStyle>, scale: number): StyleProp<TextStyle> {
  const flattened = StyleSheet.flatten(style);
  if (!flattened?.fontSize) return style;
  return [style, {
    fontSize: flattened.fontSize * scale,
    lineHeight: flattened.lineHeight ? flattened.lineHeight * scale : undefined,
  }];
}

function ChatText({ layoutScale, style, ...props }: ChatTextProps) {
  return <NativeText {...props} style={scaleTextStyle(style, layoutScale)} />;
}

function ChatInput({ layoutScale, style, ...props }: ChatInputProps) {
  return <NativeTextInput {...props} style={scaleTextStyle(style, layoutScale)} />;
}

function useChatLayout() {
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const screen = Dimensions.get('screen');
  const safeWidth = Math.max(1, windowWidth - insets.left - insets.right);
  const safeHeight = Math.max(360, screen.height - insets.top - insets.bottom);
  const scale = Math.min(safeWidth / 343, safeHeight / 683);
  return {
    scale: Math.min(1.12, Math.max(0.94, scale)),
    gutter: Math.max(10, Math.min(20, safeWidth * 0.035)),
    contentWidth: Math.min(safeWidth, 760),
    dockWidth: Math.min(safeWidth, 800),
  };
}

function makeMessage(role: MiseChatMessage['role'], content: string): MiseChatMessage {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, role, content, createdAt: new Date().toISOString() };
}

type AssistantBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: number; text: string }
  | { type: 'list'; ordered: boolean; items: Array<{ marker: string; text: string }> }
  | { type: 'quote'; text: string };

function parseAssistantBlocks(content: string): AssistantBlock[] {
  const blocks: AssistantBlock[] = [];
  let paragraph: string[] = [];
  let list: Extract<AssistantBlock, { type: 'list' }> | null = null;
  const flushParagraph = () => {
    const text = paragraph.join(' ').trim();
    if (text) blocks.push({ type: 'paragraph', text });
    paragraph = [];
  };
  const flushList = () => {
    if (list?.items.length) blocks.push(list);
    list = null;
  };

  for (const rawLine of content.replace(/\r/g, '').split('\n')) {
    const line = rawLine.trim();
    if (!line) { flushParagraph(); flushList(); continue; }
    if (/^[-*_]{3,}$/.test(line)) { flushParagraph(); flushList(); continue; }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph(); flushList();
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].replace(/\s+#+$/, '').trim() });
      continue;
    }

    const bullet = line.match(/^[-*•]\s+(.+)$/);
    const numbered = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) { flushList(); list = { type: 'list', ordered, items: [] }; }
      list.items.push({ marker: numbered?.[1] ?? '•', text: bullet?.[1] ?? numbered?.[2] ?? line });
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph(); flushList();
      blocks.push({ type: 'quote', text: quote[1] });
      continue;
    }

    flushList();
    paragraph.push(line);
  }
  flushParagraph(); flushList();
  return blocks.length ? blocks : [{ type: 'paragraph', text: content }];
}

function plainTextForCopy(content: string) {
  const cleanInline = (text: string) => text.replace(/\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_/g,
    (_match, bold, underline, italic, emphasis) => bold ?? underline ?? italic ?? emphasis ?? '');
  return parseAssistantBlocks(content).map((block) => {
    if (block.type === 'list') return block.items.map((item) => `${block.ordered ? `${item.marker}.` : '•'} ${cleanInline(item.text)}`).join('\n');
    return cleanInline(block.text);
  }).join('\n\n').trim();
}

function renderInline(text: string, layoutScale: number) {
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g);
  return parts.map((part, index) => {
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <ChatText key={index} layoutScale={layoutScale} style={styles.messageBold}>{part.slice(2, -2)}</ChatText>;
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return <ChatText key={index} layoutScale={layoutScale} style={styles.messageItalic}>{part.slice(1, -1)}</ChatText>;
    }
    return part;
  });
}

function AssistantMessageContent({ content, layoutScale }: { content: string; layoutScale: number }) {
  return <View style={[styles.formattedMessage, { gap: 8 * layoutScale }]}>
    {parseAssistantBlocks(content).map((block, index) => {
      if (block.type === 'heading') return <ChatText key={index} layoutScale={layoutScale} style={[styles.messageHeading, { marginTop: 3 * layoutScale }, block.level > 2 && styles.messageSubheading]}>{renderInline(block.text, layoutScale)}</ChatText>;
      if (block.type === 'list') return <View key={index} style={[styles.messageList, { gap: 5 * layoutScale, paddingLeft: 2 * layoutScale }]}>
        {block.items.map((item, itemIndex) => <View key={itemIndex} style={[styles.messageListRow, { gap: 8 * layoutScale }]}>
          <ChatText layoutScale={layoutScale} style={[styles.messageBullet, { minWidth: 13 * layoutScale }]}>{block.ordered ? `${item.marker}.` : '•'}</ChatText>
          <ChatText layoutScale={layoutScale} style={[styles.messageText, styles.listText]}>{renderInline(item.text, layoutScale)}</ChatText>
        </View>)}
      </View>;
      if (block.type === 'quote') return <ChatText key={index} layoutScale={layoutScale} style={[styles.messageQuote, { borderLeftWidth: 3 * layoutScale, paddingLeft: 10 * layoutScale }]}>{renderInline(block.text, layoutScale)}</ChatText>;
      return <ChatText key={index} layoutScale={layoutScale} style={styles.messageText}>{renderInline(block.text, layoutScale)}</ChatText>;
    })}
  </View>;
}

export function ChatScreen({ messages, onBack, onMessagesChange, onSendMessage, onSyncMessages, onClearConversation, onOpenAccount }: Props) {
  const insets = useSafeAreaInsets();
  const { scale: layoutScale, gutter, contentWidth, dockWidth } = useChatLayout();
  const scaled = (value: number) => value * layoutScale;
  const touchTarget = (value: number) => Math.max(44, scaled(value));
  const scrollRef = useRef<ScrollView>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 90);
    return () => clearTimeout(timer);
  }, [messages.length, sending]);

  useEffect(() => () => {
    if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
  }, []);

  const copyResponse = async (message: MiseChatMessage) => {
    try {
      await Clipboard.setStringAsync(plainTextForCopy(message.content));
      setCopiedMessageId(message.id);
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
      copyResetTimer.current = setTimeout(() => setCopiedMessageId(null), 1800);
    } catch (error) {
      Alert.alert('Couldn’t copy response', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const send = async (value = draft) => {
    const content = value.trim();
    if (!content || sending) return;
    setSynced(false);
    const userMessage = makeMessage('user', content);
    const conversation = [...messages, userMessage].slice(-32);
    onMessagesChange(conversation);
    setDraft('');
    setSending(true);
    try {
      const reply = await onSendMessage(conversation.slice(-16).map(({ role, content: messageContent }) => ({ role, content: messageContent })));
      onMessagesChange([...conversation, makeMessage('assistant', reply)]);
    } catch (error) {
      setDraft(content);
      onMessagesChange([...conversation, makeMessage('assistant', error instanceof Error ? error.message : 'I had trouble reaching the kitchen. Please try again.')]);
    } finally {
      setSending(false);
    }
  };

  const syncConversation = async () => {
    if (syncing || sending || clearing) return;
    setSyncing(true);
    setSynced(false);
    try {
      await onSyncMessages();
      setSynced(true);
    } catch (error) {
      Alert.alert('Sync didn’t finish', error instanceof Error ? error.message : 'Check your connection and try again.');
    } finally {
      setSyncing(false);
    }
  };

  const clearConversation = () => {
    if (sending || clearing || syncing || !messages.length) return;
    Alert.alert('Clear this conversation?', 'This removes the chat from this device and your synced devices.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear chat', style: 'destructive', onPress: () => {
        setClearing(true);
        void onClearConversation().then(() => setSynced(false)).catch((error) => {
          Alert.alert('Couldn’t clear chat', error instanceof Error ? error.message : 'Please try again.');
        }).finally(() => setClearing(false));
      } },
    ]);
  };

  const openChatOptions = () => Alert.alert('Mise chat', undefined, [
    { text: syncing ? 'Syncing…' : synced ? 'Sync again' : 'Sync across devices', onPress: () => { void syncConversation(); } },
    { text: 'Cooking preferences', onPress: onOpenAccount },
    ...(messages.length ? [{ text: 'Clear conversation', style: 'destructive' as const, onPress: clearConversation }] : []),
    { text: 'Cancel', style: 'cancel' },
  ]);

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 8 : 0}>
        <View style={[styles.header, {
          minHeight: scaled(52),
          paddingHorizontal: gutter,
          paddingBottom: scaled(2),
        }]}>
          <View style={[styles.headerIdentity, { gap: scaled(10) }]}>
            <Pressable onPress={onBack} style={[styles.backButton, { width: touchTarget(40), height: touchTarget(40), borderRadius: touchTarget(40) / 2 }]} accessibilityRole="button" accessibilityLabel="Back to kitchen"><Icon name="arrow-back" size={scaled(20)} color={colors.ink} /></Pressable>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={openChatOptions} disabled={sending || syncing || clearing} style={[styles.headerButton, { width: touchTarget(40), height: touchTarget(40), borderRadius: touchTarget(40) / 2 }, (sending || syncing || clearing) && styles.headerButtonDisabled]} accessibilityRole="button" accessibilityLabel="Chat options"><Icon name="ellipsis-horizontal" size={scaled(22)} color={colors.ink} /></Pressable>
          </View>
        </View>

        <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={[styles.messagesContent, {
          width: contentWidth,
          paddingHorizontal: gutter,
          paddingTop: scaled(8),
          paddingBottom: scaled(76),
          gap: scaled(12),
          maxWidth: 760,
        }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {messages.map((message, index) => {
            const isUser = message.role === 'user';
            return <Animated.View key={message.id} entering={FadeInDown.delay(index === messages.length - 1 ? 20 : 0).springify().damping(20)} style={[styles.messageRow, isUser ? styles.userMessageRow : styles.assistantMessageRow]}>
              <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble, {
                borderRadius: scaled(19),
                borderBottomLeftRadius: isUser ? scaled(19) : scaled(6),
                borderBottomRightRadius: isUser ? scaled(6) : scaled(19),
                paddingHorizontal: isUser ? scaled(13) : 0,
                paddingTop: isUser ? scaled(9) : 0,
                paddingBottom: isUser ? scaled(9) : 0,
              }]}>
                {isUser
                  ? <ChatText layoutScale={layoutScale} style={[styles.messageText, styles.userMessageText]}>{message.content}</ChatText>
                  : <AssistantMessageContent content={message.content} layoutScale={layoutScale} />}
              </View>
              {!isUser && <View style={[styles.responseActionRow, { marginTop: scaled(2) }]}>
                <Pressable onPress={() => { void copyResponse(message); }} hitSlop={6} style={[styles.copyAction, { minHeight: touchTarget(36), gap: scaled(6), paddingHorizontal: scaled(6) }]} accessibilityRole="button" accessibilityLabel={copiedMessageId === message.id ? 'Response copied' : 'Copy response'}>
                  <Icon name={copiedMessageId === message.id ? 'checkmark' : 'copy-outline'} size={scaled(17)} color={copiedMessageId === message.id ? colors.oliveDeep : colors.muted} />
                  <ChatText layoutScale={layoutScale} style={[styles.copyLabel, { color: copiedMessageId === message.id ? colors.oliveDeep : colors.muted }]}>{copiedMessageId === message.id ? 'Copied' : 'Copy'}</ChatText>
                </Pressable>
              </View>}
            </Animated.View>;
          })}
          {sending && <View style={styles.typingRow}><View style={[styles.typingBubble, { minHeight: scaled(42), gap: scaled(5), borderRadius: scaled(18), borderBottomLeftRadius: scaled(6), paddingHorizontal: scaled(13) }]}><View style={[styles.typingDot, { width: scaled(6), height: scaled(6), borderRadius: scaled(3) }]} /><View style={[styles.typingDot, styles.typingDotMiddle, { width: scaled(6), height: scaled(6), borderRadius: scaled(3) }]} /><View style={[styles.typingDot, { width: scaled(6), height: scaled(6), borderRadius: scaled(3) }]} /><ChatText layoutScale={layoutScale} style={[styles.typingText, { marginLeft: scaled(4) }]}>Mise is thinking</ChatText></View></View>}
        </ScrollView>

        <View style={[styles.composerDock, {
          paddingTop: scaled(8),
          paddingBottom: scaled(12),
          width: dockWidth,
        }]}>
          <View style={[styles.composer, {
            minHeight: scaled(46),
            maxHeight: scaled(112),
            borderRadius: scaled(24),
            paddingLeft: scaled(13),
            paddingRight: scaled(7),
            paddingVertical: scaled(4),
            maxWidth: 760,
            alignSelf: 'center',
          }]}>
            <ChatInput
              layoutScale={layoutScale}
              value={draft}
              onChangeText={setDraft}
              placeholder="Message Mise"
              placeholderTextColor="#8B9084"
              multiline
              maxLength={1200}
              editable={!sending}
              style={[styles.input, {
                maxHeight: scaled(92),
                minHeight: scaled(32),
                paddingTop: scaled(6),
                paddingBottom: scaled(4),
              }]}
              accessibilityLabel="Message Mise"
              onSubmitEditing={() => { if (Platform.OS === 'ios') void send(); }}
              blurOnSubmit={false}
            />
            <Pressable onPress={() => void send()} disabled={!draft.trim() || sending} hitSlop={4} style={[styles.sendButton, { width: scaled(38), height: scaled(38), borderRadius: scaled(14) }, (!draft.trim() || sending) && styles.sendButtonDisabled]} accessibilityRole="button" accessibilityLabel="Send message">
              <Icon name={sending ? 'hourglass-outline' : 'arrow-up'} size={scaled(20)} color={colors.ink} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  keyboard: { flex: 1 },
  header: { width: '100%', maxWidth: 800, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backButton: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9EAE2' },
  headerActions: { flexDirection: 'row' },
  headerButton: { backgroundColor: '#E9EAE2', alignItems: 'center', justifyContent: 'center' },
  headerButtonDisabled: { opacity: 0.45 },
  messages: { flex: 1 },
  messagesContent: { alignSelf: 'center', flexGrow: 1 },
  messageRow: { maxWidth: '100%', minWidth: 0 },
  assistantMessageRow: { width: '100%', alignSelf: 'stretch' },
  userMessageRow: { maxWidth: '93%', alignSelf: 'flex-end', justifyContent: 'flex-end' },
  bubble: { maxWidth: '100%', minWidth: 0 },
  assistantBubble: { width: '100%', backgroundColor: 'transparent' },
  userBubble: { backgroundColor: '#354133' },
  responseActionRow: { flexDirection: 'row', alignItems: 'center' },
  copyAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  copyLabel: { fontSize: 12, fontWeight: '700' },
  messageText: { color: colors.ink, fontSize: 15, lineHeight: 22, flexShrink: 1 },
  userMessageText: { color: '#FFFFFF' },
  formattedMessage: { width: '100%', maxWidth: '100%', minWidth: 0, gap: 8 },
  messageHeading: { color: colors.ink, fontSize: 17, lineHeight: 22, fontWeight: '800', marginTop: 3 },
  messageSubheading: { fontSize: 15, lineHeight: 21 },
  messageBold: { fontWeight: '800' },
  messageItalic: { fontStyle: 'italic' },
  messageList: { width: '100%', maxWidth: '100%', gap: 4, paddingLeft: 2 },
  messageListRow: { width: '100%', minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  messageBullet: { color: colors.oliveDeep, fontSize: 15, lineHeight: 22, fontWeight: '800', minWidth: 13, flexShrink: 0 },
  listText: { flex: 1, minWidth: 0, flexShrink: 1 },
  messageQuote: { color: '#626957', fontSize: 14, lineHeight: 21, borderLeftWidth: 3, borderLeftColor: colors.olive, paddingLeft: 10 },
  typingRow: { alignSelf: 'flex-start' },
  typingBubble: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECEBE4', borderRadius: 18, borderBottomLeftRadius: 6, paddingHorizontal: 13 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#72805B' },
  typingDotMiddle: { opacity: 0.58 },
  typingText: { color: '#777D70', fontSize: 11, marginLeft: 4, fontWeight: '600' },
  composerDock: { position: 'absolute', left: 0, right: 0, bottom: 0, maxWidth: 800, alignSelf: 'center', backgroundColor: 'rgba(246,245,239,0.97)' },
  composer: { width: '100%', borderWidth: 1, borderColor: '#E4E5DC', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', shadowColor: '#303427', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  input: { flex: 1, color: colors.ink, fontSize: 15, lineHeight: 21 },
  sendButton: { backgroundColor: colors.olive, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { backgroundColor: '#E9EAE2', opacity: 0.8 },
});
