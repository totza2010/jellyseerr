import type { User } from '@server/entity/User';
import type { PaginatedResponse } from '@server/interfaces/api/common';

export interface IgnoreItem {
  tmdbId: number;
  title?: string;
  seasonNumber: number;
  seasonTitle?: string;
  episodeNumber: number;
  episodeTitle?: string;
  createdAt?: Date;
  user: User;
}

export interface IgnoreResultsResponse extends PaginatedResponse {
  results: IgnoreItem[];
}
