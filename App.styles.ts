/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { StyleSheet } from 'react-native';

export const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentArea: {
    flex: 1,
    flexDirection: 'column',
  },
  contentAreaRow: {
    flexDirection: 'row',
  },
  messageAndUser: {
    flex: 1,
  },
  messageAndUserRow: {
    flexDirection: 'row',
  },
  messageAndUserColumn: {
    flexDirection: 'column',
  },
  messageAreaContainer: {
    flex: 1,
    flexDirection: 'row',
    position: 'relative',
    minWidth: 0,
  },
  userListToggle: {
    position: 'absolute',
    right: 0,
    top: '50%',
    transform: [{ translateY: -15 }],
    width: 30,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    zIndex: 10,
  },
  userListToggleText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.modalOverlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockOverlay: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.modalBackground,
    borderRadius: 8,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: colors.modalText,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: 12,
    fontSize: 14,
    marginBottom: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 4,
  },
  modalButtonCancel: {
    backgroundColor: colors.buttonSecondary,
  },
  modalButtonJoin: {
    backgroundColor: colors.buttonPrimary,
  },
  modalButtonText: {
    fontSize: 14,
    color: colors.buttonSecondaryText,
  },
  modalButtonTextPrimary: {
    color: colors.buttonPrimaryText,
    fontWeight: '600',
  },
  killSwitchButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  killSwitchText: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionsMenu: {
    backgroundColor: colors.modalBackground,
    borderRadius: 8,
    padding: 10,
    width: '80%',
    maxWidth: 300,
    alignSelf: 'center',
  },
  optionItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: {
    fontSize: 16,
    color: colors.modalText,
    textAlign: 'center',
  },
  destructiveOption: {
    color: colors.error,
  },
  bannerAdContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: 50,
    flexShrink: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bannerAdHidden: {
    height: 0,
    minHeight: 0,
    paddingVertical: 0,
    borderTopWidth: 0,
    opacity: 0,
    overflow: 'hidden',
  },
});
