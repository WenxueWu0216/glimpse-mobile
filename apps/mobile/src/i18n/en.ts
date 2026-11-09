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
  },
};

export type Translations = typeof en;
