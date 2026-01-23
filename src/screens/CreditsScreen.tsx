import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Linking,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/transifex';

interface CreditsScreenProps {
  visible: boolean;
  onClose: () => void;
}

interface Translator {
  nick: string;
  url?: string;
}

interface LanguageCredits {
  language: string;
  translators: Translator[];
}

// Translation credits data
const TRANSLATION_CREDITS: LanguageCredits[] = [
  {
    language: 'English',
    translators: [{ nick: 'munZe' }],
  },
  {
    language: 'Spanish',
    translators: [{ nick: 'ARGENTIN07 🇦🇷' }, { nick: 'Cubanita83 🇨🇺' }],
  },
];

export const CreditsScreen: React.FC<CreditsScreenProps> = ({
  visible,
  onClose,
}) => {
  const { colors } = useTheme();
  const t = useT();
  const styles = createStyles(colors);

  const handleOpenURL = (url: string) => {
    Linking.openURL(url).catch(err => console.error('Failed to open URL:', err));
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('Credits')}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>{t('Close')}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {/* Translators Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('Translators')}</Text>
            <Text style={styles.sectionDescription}>
              {t('Special thanks to everyone who helped translate AndroidIRCX into different languages.')}
            </Text>
          </View>

          {/* Language Credits */}
          {TRANSLATION_CREDITS.map((langCredit, index) => (
            <View key={index} style={styles.languageSection}>
              <Text style={styles.languageLabel}>{langCredit.language}</Text>
              <View style={styles.translatorsContainer}>
                {langCredit.translators.map((translator, tIndex) => (
                  <View key={tIndex} style={styles.translatorBadge}>
                    {translator.url ? (
                      <TouchableOpacity onPress={() => handleOpenURL(translator.url!)}>
                        <Text style={[styles.translatorNick, styles.link]}>{translator.nick}</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.translatorNick}>{translator.nick}</Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
          ))}

          {/* Help Translate Section */}
          <View style={styles.helpSection}>
            <Text style={styles.helpTitle}>{t('Help Translate')}</Text>
            <Text style={styles.helpText}>
              {t('Want to help translate AndroidIRCX into your language? We use Transifex for translations and would love your help!')}
            </Text>
            <Text style={styles.helpInstructions}>
              {t('Send an email to the address below with the language you want to translate, and we will invite you to our Transifex project. Once you complete the translations, your name will be added to this credits page.')}
            </Text>
            <TouchableOpacity
              style={styles.emailButton}
              onPress={() => handleOpenURL('mailto:contact@androidircx.com?subject=Translation%20Help%20-%20AndroidIRCX')}>
              <Text style={styles.emailButtonText}>contact@androidircx.com</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {t('Thank you to all contributors!')}
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background || '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#E0E0E0',
    backgroundColor: colors.surface || '#F5F5F5',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text || '#212121',
  },
  closeButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  closeButtonText: {
    color: colors.buttonPrimary || '#2196F3',
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text || '#212121',
    marginBottom: 8,
    textAlign: 'center',
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.textSecondary || '#757575',
    textAlign: 'center',
    lineHeight: 20,
  },
  languageSection: {
    marginBottom: 20,
    backgroundColor: colors.surface || '#F5F5F5',
    borderRadius: 12,
    padding: 16,
  },
  languageLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text || '#212121',
    marginBottom: 10,
  },
  translatorsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  translatorBadge: {
    backgroundColor: colors.buttonPrimary || '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  translatorNick: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  link: {
    textDecorationLine: 'underline',
  },
  helpSection: {
    marginTop: 16,
    marginBottom: 24,
    backgroundColor: colors.surface || '#F5F5F5',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.buttonPrimary || '#2196F3',
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text || '#212121',
    marginBottom: 12,
    textAlign: 'center',
  },
  helpText: {
    fontSize: 14,
    color: colors.textSecondary || '#757575',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  helpInstructions: {
    fontSize: 14,
    color: colors.text || '#212121',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  emailButton: {
    backgroundColor: colors.buttonPrimary || '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'center',
  },
  emailButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border || '#E0E0E0',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: colors.textSecondary || '#757575',
    fontStyle: 'italic',
  },
});
