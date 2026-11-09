import type { Translations } from './en';

export const zh: Translations = {
  tabs: { feed: '发现', saved: '收藏', settings: '设置' },
  feed: {
    title: 'Glimpse',
    emptyTitle: '还没有笔记',
    emptyBody: '来发布第一篇吧。',
    errorTitle: '加载失败',
    errorBody: '请检查网络后重试。',
    retry: '重试',
    loading: '正在加载笔记',
    loadingMore: '正在加载更多',
  },
  note: {
    like: '点赞',
    unlike: '取消点赞',
    likes_one: '{{count}} 个赞',
    likes_other: '{{count}} 个赞',
  },
};
