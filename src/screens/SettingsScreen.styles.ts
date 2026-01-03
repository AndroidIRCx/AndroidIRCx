import { StyleSheet } from 'react-native';
import { Theme } from '../services/ThemeService';

export const createStyles = (colors: any, theme: Theme) => {
  const isDark = theme.id === 'dark';
  const headerBg = colors.surface;
  const sectionBg = colors.surface;
  const sectionText = isDark ? colors.primary : colors.text;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: headerBg,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
    },
    closeButton: {
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    closeButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '500',
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingBottom: 20,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      backgroundColor: colors.surfaceVariant,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      color: colors.text,
    },
    clearSearch: {
      color: colors.primary,
      fontWeight: '600',
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      backgroundColor: sectionBg,
    },
    sectionTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    sectionIcon: {
      marginRight: 10,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: sectionText,
    },
    sectionToggle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: sectionText,
    },
    settingItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    disabledItem: {
      opacity: 0.5,
    },
    settingContent: {
      flex: 1,
      marginRight: 16,
    },
    settingTitle: {
      fontSize: 16,
      color: colors.text,
      marginBottom: 4,
    },
    settingTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    settingIcon: {
      fontSize: 16,
      marginRight: 8,
    },
    settingDescription: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    disabledText: {
      opacity: 0.5,
    },
    chevron: {
      fontSize: 20,
      color: colors.textSecondary,
    },
    watchAdButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 16,
      marginVertical: 8,
    },
    watchAdButtonDisabled: {
      opacity: 0.6,
    },
    watchAdButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
    },
    submenuOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    submenuContainer: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: '80%',
    },
    submenuHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    submenuTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    submenuItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    submenuItemContent: {
      flex: 1,
    },
    submenuItemText: {
      fontSize: 16,
      color: colors.text,
    },
    submenuItemDescription: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    submenuInput: {
      borderWidth: 1,
      borderRadius: 4,
      padding: 8,
      fontSize: 14,
      marginTop: 8,
      borderColor: colors.border,
      color: colors.text,
      backgroundColor: colors.surfaceVariant,
    },
    input: {
      borderWidth: 1,
      borderRadius: 4,
      padding: 8,
      fontSize: 14,
      marginTop: 8,
      borderColor: colors.border,
      color: colors.text,
      backgroundColor: colors.surfaceVariant,
    },
    disabledInput: {
      opacity: 0.5,
    },
    identityModal: {
      paddingBottom: 12,
    },
    identityModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    identityModalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    identityModalSubtitle: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      color: colors.textSecondary,
    },
    identityList: {
      maxHeight: '60%',
    },
    identityItem: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    identityItemText: {
      fontSize: 16,
      color: colors.text,
    },
    identityItemSub: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    identityEmpty: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      color: colors.textSecondary,
    },
    identityDelete: {
      paddingVertical: 14,
      alignItems: 'center',
    },
    identityDeleteText: {
      color: colors.error,
      fontWeight: '600',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    migrationDialog: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 20,
      width: '85%',
      maxWidth: 400,
      maxHeight: '70%',
    },
    migrationDialogTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    migrationDialogDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    networkList: {
      maxHeight: 200,
      marginBottom: 16,
    },
    networkItem: {
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
      backgroundColor: colors.background,
    },
    networkItemSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    networkItemText: {
      fontSize: 16,
      color: colors.text,
    },
    networkItemTextSelected: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    migrationDialogButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    migrationDialogButton: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    migrationDialogButtonCancel: {
      backgroundColor: colors.surfaceVariant,
    },
    migrationDialogButtonMigrate: {
      backgroundColor: colors.primary,
    },
    migrationDialogButtonDisabled: {
      opacity: 0.5,
    },
    migrationDialogButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    migrationDialogButtonTextMigrate: {
      color: '#FFFFFF',
    },
  });
};
