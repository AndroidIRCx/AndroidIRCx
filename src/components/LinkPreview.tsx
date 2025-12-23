import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Linking,
  ActivityIndicator,
  Alert,
} from 'react-native';
import RNFS from 'react-native-fs';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/transifex';

interface LinkPreviewProps {
  url: string;
  onPress?: () => void;
  showDownloadButton?: boolean;
}

interface LinkMetadata {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  displayUrl?: string;
}

const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'];

const safeParseUrl = (rawUrl: string): URL | null => {
  try {
    const normalized = rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`;
    return new URL(normalized);
  } catch {
    return null;
  }
};

const getYouTubeVideoId = (rawUrl: string): string | null => {
  const parsed = safeParseUrl(rawUrl);
  if (!parsed) return null;
  const host = parsed.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.includes(host)) return null;

  if (host === 'youtu.be') {
    const parts = parsed.pathname.split('/').filter(Boolean);
    return parts[0] || null;
  }

  if (parsed.searchParams.has('v')) {
    return parsed.searchParams.get('v');
  }

  const pathParts = parsed.pathname.split('/').filter(Boolean);
  // Handle /embed/{id} or /shorts/{id}
  if (pathParts.length >= 2 && (pathParts[0] === 'embed' || pathParts[0] === 'shorts')) {
    return pathParts[1];
  }

  return null;
};

const isYouTubeUrl = (rawUrl: string): boolean => {
  const parsed = safeParseUrl(rawUrl);
  if (!parsed) return false;
  return YOUTUBE_HOSTS.includes(parsed.hostname.toLowerCase());
};

const getYouTubeThumbnail = (videoId: string): string =>
  `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

const resolveImageUrl = (rawUrl: string, pageUrl: string): string => {
  if (!rawUrl) return rawUrl;
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  if (rawUrl.startsWith('//')) {
    const base = safeParseUrl(pageUrl);
    const protocol = base?.protocol || 'https:';
    return `${protocol}${rawUrl}`;
  }
  const base = safeParseUrl(pageUrl);
  if (!base) return rawUrl;
  const prefix = base.origin;
  const path = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
  return `${prefix}${path}`;
};

const formatDisplayParts = (rawUrl: string): { title: string; siteName: string; displayUrl: string } => {
  const parsed = safeParseUrl(rawUrl);
  if (!parsed) {
    return {
      title: '',
      siteName: rawUrl,
      displayUrl: rawUrl,
    };
  }
  const siteName = parsed.hostname;
  const path = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '';
  const title = '';
  const displayUrl = decodeURIComponent(`${siteName}${path}${parsed.search || ''}`);
  return { title, siteName, displayUrl };
};

const fetchPageMetadata = async (targetUrl: string, signal?: AbortSignal): Promise<LinkMetadata | undefined> => {
  try {
    const response = await fetch(targetUrl, { signal });
    const html = await response.text();

    // Prefer Open Graph
    const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["'][^>]*>/i);
    const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["'][^>]*>/i);
    const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i);
    const ogSite = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:site_name["'][^>]*>/i);
    const twitterImage = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["'][^>]*>/i);

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = ogTitle?.[1]?.trim() || titleMatch?.[1]?.trim();
    const description = ogDesc?.[1]?.trim();
    const image = ogImage?.[1]?.trim() || twitterImage?.[1]?.trim();
    const siteName = ogSite?.[1]?.trim();

    return { title, description, image, siteName };
  } catch (err) {
    // Ignore fetch errors for metadata
  }
  return undefined;
};

export const LinkPreview: React.FC<LinkPreviewProps> = ({
  url,
  onPress,
  showDownloadButton = true,
}) => {
  const t = useT();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const tags = 'feature:link-preview,file:LinkPreview.tsx,component:LinkPreview';
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    const { title, siteName, displayUrl } = formatDisplayParts(url);
    const defaultMetadata: LinkMetadata = {
      title,
      description: undefined,
      image: undefined,
      siteName,
      displayUrl,
    };

    const maybeFetchYouTube = async () => {
      if (!isYouTubeUrl(url)) {
        if (isMounted) setMetadata(defaultMetadata);
        return;
      }
      const videoId = getYouTubeVideoId(url);
      if (!videoId) {
        if (isMounted) setMetadata(defaultMetadata);
        return;
      }

      try {
        setLoading(true);
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const response = await fetch(oembedUrl);
        if (!response.ok) {
          throw new Error(`Status ${response.status}`);
        }
        const data = await response.json();
        if (!isMounted) return;
        setMetadata({
          title: data?.title || defaultMetadata.title,
          description: defaultMetadata.description,
          image: data?.thumbnail_url || getYouTubeThumbnail(videoId),
          siteName: 'YouTube',
        });
      } catch (e) {
        if (isMounted) setMetadata({
          ...defaultMetadata,
          image: getYouTubeThumbnail(videoId),
          siteName: 'YouTube',
        });
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const fetchMetadata = async () => {
      if (isYouTubeUrl(url)) {
        await maybeFetchYouTube();
        return;
      }

      // Try to fetch page metadata (title, og:image) for non-YouTube links
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      let pageMetadata: LinkMetadata | undefined;
      try {
        pageMetadata = await fetchPageMetadata(url, controller.signal);
      } finally {
        clearTimeout(timer);
      }

      const merged: LinkMetadata = {
        ...defaultMetadata,
        title: pageMetadata?.title || defaultMetadata.title || defaultMetadata.displayUrl,
        description: pageMetadata?.description,
        image: pageMetadata?.image ? resolveImageUrl(pageMetadata.image, url) : defaultMetadata.image,
        siteName: pageMetadata?.siteName || defaultMetadata.siteName,
      };
      if (isMounted) setMetadata(merged);
    };

    fetchMetadata();

    return () => {
      isMounted = false;
    };
  }, [url]);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      Linking.openURL(url).catch(err => {
        console.error('Failed to open URL:', err);
      });
    }
  };

  const handleDownload = async () => {
    if (downloading) return;
    try {
      setDownloading(true);
      setProgress(0);
      const fileName = decodeURIComponent(url.split('/').pop()?.split('?')[0] || 'download');
      const destPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
      const ret = RNFS.downloadFile({
        fromUrl: url,
        toFile: destPath,
        progressDivider: 5,
        progress: (data) => {
          if (data.contentLength > 0) {
            const pct = Math.floor((data.bytesWritten / data.contentLength) * 100);
            setProgress(pct);
          }
        },
      });
      await ret.promise;
      setProgress(100);
      Alert.alert(
        t('Download complete', { _tags: tags }),
        t('Saved to {path}', { path: destPath, _tags: tags })
      );
    } catch (e: any) {
      Alert.alert(
        t('Download failed', { _tags: tags }),
        e?.message || t('Unable to download file', { _tags: tags })
      );
    } finally {
      setDownloading(false);
    }
  };

  if (error) {
    return null;
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}>
      {metadata?.image && (
        <Image
          source={{ uri: metadata.image }}
          style={styles.image}
          resizeMode="cover"
        />
      )}
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <>
            {metadata?.siteName && (
              <Text style={styles.siteName} numberOfLines={1}>
                {metadata.siteName}
              </Text>
            )}
            {metadata?.title && (
              <Text style={styles.title} numberOfLines={2}>
                {metadata.title}
              </Text>
            )}
            {metadata?.description && (
              <Text style={styles.description} numberOfLines={2}>
                {metadata.description}
              </Text>
            )}
            {(metadata?.displayUrl || url) && (
              <Text style={styles.url} numberOfLines={1}>
                {metadata?.displayUrl || url}
              </Text>
            )}
            {showDownloadButton && (
              <TouchableOpacity style={styles.downloadButton} onPress={handleDownload} disabled={downloading}>
                {downloading ? (
                  <View style={styles.downloadRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.downloadText}>
                      {progress !== null ? `${progress}%` : t('...', { _tags: tags })}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.downloadText}>{t('Download', { _tags: tags })}</Text>
                )}
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: 8,
    marginVertical: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: {
    width: '100%',
    height: 150,
    backgroundColor: colors.surface,
  },
  content: {
    padding: 12,
  },
  siteName: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
    fontWeight: '500',
  },
  title: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  url: {
    fontSize: 11,
    color: colors.primary,
    marginTop: 4,
  },
  downloadButton: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.buttonSecondary,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  downloadText: {
    color: colors.buttonSecondaryText,
    fontSize: 12,
    fontWeight: '600',
  },
  downloadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});

