export const en = {
  tabs: { feed: 'Discover', saved: 'Saved', settings: 'Settings' },
  feed: {
    title: 'Glimpse',
    emptyTitle: 'No notes yet',
    emptyBody: 'Be the first to share something.',
    errorTitle: "Couldn't load the feed",
    errorBody: 'Check your connection and try again.',
    retry: 'Try again',
    loading: 'Loading notes',
    loadingMore: 'Loading more notes',
  },
  note: {
    like: 'Like',
    unlike: 'Unlike',
    likes_one: '{{count}} like',
    likes_other: '{{count}} likes',
    save: 'Save',
    unsave: 'Remove from saved',
    actionFailed: "Couldn't update. Please try again.",
    errorTitle: "Couldn't load this note",
    photoOf: 'Photo {{index}} of {{total}}',
  },
  saved: {
    emptyTitle: 'Nothing saved yet',
    emptyBody: 'Tap the bookmark on a note to keep it here.',
    errorTitle: "Couldn't load saved notes",
  },
  composer: {
    open: 'New note',
    title: 'New note',
    addPhoto: 'Add photos',
    removePhoto: 'Remove photo',
    titlePlaceholder: 'Add a title',
    bodyPlaceholder: 'Share the details…',
    tagsPlaceholder: 'Add tags (space to confirm)',
    publish: 'Publish',
    publishFailed: "Couldn't publish. Check your connection and try again.",
  },
};

export type Translations = typeof en;
