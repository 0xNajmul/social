<?php

namespace App\Services\Feeds;

use App\Models\RssFeed;
use App\Models\RssFeedItem;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;
use SimpleXMLElement;

class RssFeedIngestor
{
    public function ingest(RssFeed $feed, int $limit = 30): int
    {
        $response = Http::timeout(20)
            ->withHeaders(['User-Agent' => 'PostFlow Feed Reader/1.0'])
            ->get($feed->url);

        if (! $response->successful()) {
            throw new RuntimeException("Feed returned HTTP {$response->status()}.");
        }

        $xml = $this->parseXml($response->body());
        $feedTitle = $this->feedTitle($xml);
        $items = array_slice($this->items($xml), 0, $limit);
        $created = 0;

        foreach ($items as $item) {
            $guid = $item['guid'] ?: md5(($item['link'] ?: $item['title']).'|'.$feed->id);
            $record = RssFeedItem::updateOrCreate(
                ['rss_feed_id' => $feed->id, 'guid' => Str::limit($guid, 255, '')],
                [
                    'title' => Str::limit($item['title'] ?: $feed->title ?: $feedTitle ?: 'Untitled feed item', 255, ''),
                    'summary' => $item['summary'],
                    'link' => $item['link'] ? Str::limit($item['link'], 255, '') : null,
                    'image_url' => $item['image_url'] ? Str::limit($item['image_url'], 255, '') : null,
                    'published_at' => $item['published_at'],
                ],
            );

            if ($record->wasRecentlyCreated) {
                $created++;
            }
        }

        $feed->update([
            'title' => $feed->title ?: $feedTitle,
            'last_item_guid' => ($items[0]['guid'] ?? null) ?: $feed->last_item_guid,
            'last_fetched_at' => now(),
        ]);

        return $created;
    }

    protected function parseXml(string $body): SimpleXMLElement
    {
        libxml_use_internal_errors(true);
        $xml = simplexml_load_string($body, SimpleXMLElement::class, LIBXML_NOCDATA | LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
        libxml_clear_errors();

        if (! $xml) {
            throw new RuntimeException('Feed URL did not return valid RSS or Atom XML.');
        }

        return $xml;
    }

    protected function feedTitle(SimpleXMLElement $xml): ?string
    {
        return $this->clean((string) ($xml->channel->title ?? $xml->title ?? '')) ?: null;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    protected function items(SimpleXMLElement $xml): array
    {
        $entries = [];

        if (isset($xml->channel->item)) {
            foreach ($xml->channel->item as $item) {
                $entries[] = $this->rssItem($item);
            }

            return $entries;
        }

        foreach ($xml->entry ?? [] as $entry) {
            $entries[] = $this->atomItem($entry);
        }

        return $entries;
    }

    /**
     * @return array<string, mixed>
     */
    protected function rssItem(SimpleXMLElement $item): array
    {
        $namespaces = $item->getNamespaces(true);
        $media = isset($namespaces['media']) ? $item->children($namespaces['media']) : null;
        $enclosure = $item->enclosure ?? null;

        return [
            'guid' => $this->clean((string) ($item->guid ?? $item->link ?? $item->title ?? '')),
            'title' => $this->clean((string) ($item->title ?? '')),
            'summary' => $this->clean((string) ($item->description ?? $item->summary ?? '')),
            'link' => $this->clean((string) ($item->link ?? '')) ?: null,
            'image_url' => $this->imageUrl($media, $enclosure),
            'published_at' => $this->date((string) ($item->pubDate ?? $item->published ?? $item->updated ?? '')),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function atomItem(SimpleXMLElement $entry): array
    {
        $link = '';
        foreach ($entry->link ?? [] as $candidate) {
            $attributes = $candidate->attributes();
            if ((string) ($attributes['rel'] ?? 'alternate') === 'alternate' && (string) ($attributes['href'] ?? '') !== '') {
                $link = (string) $attributes['href'];
                break;
            }
            $link = (string) ($attributes['href'] ?? $candidate);
        }

        return [
            'guid' => $this->clean((string) ($entry->id ?? $link ?? $entry->title ?? '')),
            'title' => $this->clean((string) ($entry->title ?? '')),
            'summary' => $this->clean((string) ($entry->summary ?? $entry->content ?? '')),
            'link' => $this->clean($link) ?: null,
            'image_url' => null,
            'published_at' => $this->date((string) ($entry->published ?? $entry->updated ?? '')),
        ];
    }

    protected function imageUrl(?SimpleXMLElement $media, ?SimpleXMLElement $enclosure): ?string
    {
        if ($media) {
            foreach (['thumbnail', 'content'] as $node) {
                if (isset($media->{$node})) {
                    $url = (string) ($media->{$node}->attributes()['url'] ?? '');
                    if ($url !== '') {
                        return $url;
                    }
                }
            }
        }

        if ($enclosure) {
            $type = (string) ($enclosure->attributes()['type'] ?? '');
            $url = (string) ($enclosure->attributes()['url'] ?? '');
            if ($url !== '' && str_starts_with($type, 'image/')) {
                return $url;
            }
        }

        return null;
    }

    protected function date(string $value): ?\DateTimeInterface
    {
        if (trim($value) === '') {
            return null;
        }

        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }

    protected function clean(string $value): string
    {
        $value = html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $value = strip_tags($value);

        return trim(preg_replace('/\s+/', ' ', $value) ?: '');
    }
}
