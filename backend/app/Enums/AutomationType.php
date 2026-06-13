<?php

namespace App\Enums;

enum AutomationType: string
{
    case RssFeed = 'rss_feed';
    case Blog = 'blog';
    case YoutubeChannel = 'youtube_channel';
    case CsvImport = 'csv_import';
    case Recycle = 'recycle';
    case RepostTopPerforming = 'repost_top_performing';

    public function label(): string
    {
        return match ($this) {
            self::RssFeed => 'RSS feed',
            self::Blog => 'Blog / website',
            self::YoutubeChannel => 'YouTube channel',
            self::CsvImport => 'CSV import',
            self::Recycle => 'Evergreen recycle',
            self::RepostTopPerforming => 'Repost top performing',
        };
    }
}
