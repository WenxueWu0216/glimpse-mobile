import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { prependToFeed } from '../../api/noteCache';
import { createNote } from '../../api/notes';
import type { DraftImage, Note } from '../../api/types';
import { TagChip } from '../../components/TagChip';
import { useTheme } from '../../theme/useTheme';
import { addTag } from '../../utils/tags';

const MAX_IMAGES = 9;
const TITLE_MAX = 100;

interface Props {
  onPublished: (note: Note) => void;
}

export function ComposerScreen({ onPublished }: Props) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const client = useQueryClient();

  const [images, setImages] = useState<DraftImage[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const publish = useMutation({
    mutationFn: createNote,
    onSuccess: (note) => {
      prependToFeed(client, note);
      onPublished(note);
    },
  });

  const pickImages = async () => {
    // The system photo picker runs in a separate process, so no media-library
    // permission prompt is needed just to choose pictures.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
      quality: 0.8,
    });
    if (result.canceled) return;
    const picked = result.assets.map<DraftImage>((asset, i) => ({
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
      fileName: asset.fileName ?? `photo-${Date.now()}-${i}.jpg`,
      file: asset.file,
    }));
    setImages((current) => [...current, ...picked].slice(0, MAX_IMAGES));
  };

  const commitTag = (raw: string) => {
    setTags((current) => addTag(current, raw));
    setTagInput('');
  };

  const onChangeTagInput = (text: string) => {
    // Typing a space or comma finishes the current tag.
    if (/[\s,，]$/.test(text)) commitTag(text);
    else setTagInput(text);
  };

  const canPublish = images.length > 0 && title.trim().length > 0 && !publish.isPending;

  const submit = () => {
    if (!canPublish) return;
    publish.mutate({
      title: title.trim(),
      body: body.trim(),
      tags: addTag(tags, tagInput),
      lang: i18n.language,
      images,
    });
  };

  const inputStyle = [styles.input, { color: theme.text, borderBottomColor: theme.border }];

  return (
    // The keyboard covers the bottom of the screen; on iOS the view must be
    // padded manually, Android resizes the window by itself.
    <KeyboardAvoidingView
      style={[styles.fill, { backgroundColor: theme.card }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photos}
        >
          {images.map((image) => (
            <View key={image.uri}>
              <Image source={image.uri} style={styles.photo} contentFit="cover" />
              <Pressable
                onPress={() => setImages((current) => current.filter((i) => i.uri !== image.uri))}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('composer.removePhoto')}
                style={styles.remove}
              >
                <Ionicons name="close" size={14} color="#fff" />
              </Pressable>
            </View>
          ))}
          {images.length < MAX_IMAGES ? (
            <Pressable
              testID="composer-add-photo"
              onPress={() => void pickImages()}
              accessibilityRole="button"
              accessibilityLabel={t('composer.addPhoto')}
              style={[styles.photo, styles.addPhoto, { borderColor: theme.border }]}
            >
              <Ionicons name="add" size={30} color={theme.textMuted} />
              <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                {images.length}/{MAX_IMAGES}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>

        <TextInput
          testID="composer-title"
          value={title}
          onChangeText={setTitle}
          placeholder={t('composer.titlePlaceholder')}
          placeholderTextColor={theme.textMuted}
          maxLength={TITLE_MAX}
          style={[inputStyle, styles.titleInput]}
          returnKeyType="next"
        />
        <TextInput
          testID="composer-body"
          value={body}
          onChangeText={setBody}
          placeholder={t('composer.bodyPlaceholder')}
          placeholderTextColor={theme.textMuted}
          multiline
          textAlignVertical="top"
          style={[inputStyle, styles.bodyInput]}
        />

        {tags.length > 0 ? (
          <View style={styles.tags}>
            {tags.map((tag) => (
              <TagChip
                key={tag}
                label={tag}
                selected
                onPress={(label) => setTags((current) => current.filter((x) => x !== label))}
              />
            ))}
          </View>
        ) : null}
        <TextInput
          testID="composer-tags"
          value={tagInput}
          onChangeText={onChangeTagInput}
          onSubmitEditing={() => commitTag(tagInput)}
          placeholder={t('composer.tagsPlaceholder')}
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          submitBehavior="submit"
          style={inputStyle}
        />

        {publish.isError ? (
          <Text style={[styles.error, { color: theme.danger }]} accessibilityRole="alert">
            {t('composer.publishFailed')}
          </Text>
        ) : null}

        <Pressable
          testID="composer-publish"
          onPress={submit}
          disabled={!canPublish}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canPublish, busy: publish.isPending }}
          style={[
            styles.publish,
            { backgroundColor: theme.primary, opacity: canPublish ? 1 : 0.45 },
          ]}
        >
          {publish.isPending ? (
            <ActivityIndicator color={theme.onPrimary} />
          ) : (
            <Text style={[styles.publishLabel, { color: theme.onPrimary }]}>
              {t('composer.publish')}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 16, gap: 14 },
  photos: { gap: 8 },
  photo: { width: 96, height: 96, borderRadius: 8 },
  addPhoto: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: { fontSize: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  titleInput: { fontSize: 18, fontWeight: '600' },
  bodyInput: { minHeight: 120 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { fontSize: 14 },
  publish: {
    marginTop: 8,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishLabel: { fontSize: 16, fontWeight: '700' },
});
