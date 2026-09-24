/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ModalSafeArea } from '../components/ModalSafeArea';
import { useTheme } from '../hooks/useTheme';
import { ADDON_CAPABILITY_DEFINITIONS } from '../services/scripting/AddonCapabilities';
import {
  addonAuditService,
  type AddonAuditEntry,
} from '../services/scripting/AddonAuditService';
import type {
  AddonCapability,
  AddonManifest,
} from '../services/scripting/AddonManifest';
import { addonPermissionService } from '../services/scripting/AddonPermissionService';
import { addonRawMiddleware } from '../services/scripting/AddonRawMiddleware';
import { addonDiagnostics } from '../services/scripting/AddonDiagnostics';
import type { AddonEventPreviewResult } from '../services/scripting/AddonEventRouter';

interface Props {
  visible: boolean;
  manifest: AddonManifest;
  enabled: boolean;
  disabledReason?: string;
  onClose: () => void;
  onSetEnabled: (enabled: boolean) => void | Promise<void>;
  onUninstall: () => void | Promise<void>;
  onRollback?: () => void | Promise<void>;
  onReviewSource: () => void;
  onExportSource?: () => void | Promise<void>;
  onExportDiagnostics?: () => void | Promise<void>;
  onPreviewDisplay?: () => Promise<AddonEventPreviewResult>;
}

export const AddonPermissionManagerScreen: React.FC<Props> = props => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [effective, setEffective] = useState<AddonCapability[]>([]);
  const [audit, setAudit] = useState<AddonAuditEntry[]>([]);
  const [preview, setPreview] = useState<AddonEventPreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [raw, setRaw] = useState(() =>
    addonRawMiddleware.getDiagnostics(props.manifest.id),
  );
  const [rawSuspended, setRawSuspended] = useState(() =>
    addonRawMiddleware.isSuspended(),
  );
  const [health, setHealth] = useState(() =>
    addonDiagnostics.health(props.manifest.id),
  );

  // Only shown for an addon that actually asked for expert mode, so an
  // ordinary addon's page is not cluttered with protocol machinery.
  const declaresRawModify =
    props.manifest.permissions.includes('irc.raw.modify');

  const refresh = useCallback(() => {
    setEffective(
      addonPermissionService.getEffectiveGrants(
        props.manifest.id,
        props.manifest.permissions,
      ),
    );
    setAudit(addonAuditService.list(props.manifest.id));
    setRaw(addonRawMiddleware.getDiagnostics(props.manifest.id));
    setRawSuspended(addonRawMiddleware.isSuspended());
    setHealth(addonDiagnostics.health(props.manifest.id));
  }, [props.manifest]);

  useEffect(() => {
    if (!props.visible) return;
    let active = true;
    Promise.all([
      addonPermissionService.initialize(),
      addonAuditService.initialize(),
    ]).then(() => {
      if (active) refresh();
    });
    return () => {
      active = false;
    };
  }, [props.visible, refresh]);

  const grant = async (capability: AddonCapability, persist: boolean) => {
    await addonPermissionService.grant(
      props.manifest.id,
      props.manifest.permissions,
      capability,
      persist,
    );
    refresh();
  };

  const revoke = async (capability: AddonCapability) => {
    await addonPermissionService.revoke(props.manifest.id, capability);
    refresh();
  };

  const confirmUninstall = () =>
    Alert.alert(
      'Uninstall addon?',
      'The addon will be removed. Its data is handled separately.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Uninstall', style: 'destructive', onPress: props.onUninstall },
      ],
    );

  const previewDisplay = async () => {
    if (!props.onPreviewDisplay || previewing) return;
    setPreviewing(true);
    try {
      setPreview(await props.onPreviewDisplay());
    } catch (error) {
      Alert.alert('Preview failed', String(error));
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      onRequestClose={props.onClose}
    >
      <ModalSafeArea style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{props.manifest.name}</Text>
            <Text style={styles.meta}>{props.manifest.id}</Text>
          </View>
          <TouchableOpacity onPress={props.onClose} accessibilityRole="button">
            <Text style={styles.link}>Close</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {props.disabledReason ? (
            <View style={styles.recoveryBox}>
              <Text style={styles.recoveryTitle}>Recovery status</Text>
              <Text style={styles.body}>
                Disabled because: {props.disabledReason}
              </Text>
            </View>
          ) : null}
          <Text style={styles.section}>Permissions</Text>
          {props.manifest.permissions.map(capability => {
            const definition = ADDON_CAPABILITY_DEFINITIONS[capability];
            const granted = effective.includes(capability);
            return (
              <View key={capability} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{definition.title}</Text>
                  <Text style={granted ? styles.granted : styles.denied}>
                    {granted ? 'GRANTED' : 'NOT GRANTED'}
                  </Text>
                </View>
                <Text style={styles.meta}>{capability}</Text>
                <Text style={styles.body}>{definition.disclosure}</Text>
                <View style={styles.row}>
                  {granted ? (
                    <Action
                      label="Revoke"
                      danger
                      onPress={() => revoke(capability)}
                      styles={styles}
                    />
                  ) : (
                    <>
                      <Action
                        label="Allow this session"
                        onPress={() => grant(capability, false)}
                        styles={styles}
                      />
                      {definition.persistentGrantAllowed ? (
                        <Action
                          label="Always allow"
                          onPress={() => grant(capability, true)}
                          styles={styles}
                        />
                      ) : null}
                    </>
                  )}
                </View>
              </View>
            );
          })}

          <Text style={styles.section}>Health</Text>
          <Text style={styles.meta}>
            {health.counters.events} events ({health.eventsPerMinute}/min) ·{' '}
            {Math.round(health.counters.executionMs)}ms total · slowest{' '}
            {Math.round(health.counters.slowestMs)}ms
          </Text>
          <Text style={styles.meta}>
            {health.counters.errors} errors · {health.counters.timeouts}{' '}
            timeouts · {health.counters.ircSends} IRC sends ·{' '}
            {health.counters.networkCalls} network calls
          </Text>
          {health.recentErrors.length > 0 ? (
            <>
              <Text style={styles.meta}>Last error:</Text>
              <Text style={styles.body}>
                {health.recentErrors[health.recentErrors.length - 1].hook}:{' '}
                {health.recentErrors[health.recentErrors.length - 1].message}
              </Text>
            </>
          ) : (
            <Text style={styles.meta}>No errors recorded</Text>
          )}

          <Text style={styles.section}>Activity</Text>
          <Text style={styles.body}>
            {audit.length} sensitive actions recorded
          </Text>
          {audit
            .slice(-5)
            .reverse()
            .map(entry => (
              <Text key={entry.id} style={styles.meta}>
                {entry.action} · {entry.target} · {entry.result}
              </Text>
            ))}

          {declaresRawModify ? (
            <>
              <Text style={styles.section}>Raw traffic</Text>
              <Text style={styles.body}>
                Expert mode. This addon can rewrite outgoing protocol lines.
                Lines the connection itself depends on - PING, PONG, CAP,
                AUTHENTICATE, ERROR and PASS - are never shown to it, and
                incoming traffic is observed but never changed.
              </Text>
              <Text style={styles.meta}>
                {raw.counters.evaluated} lines seen · {raw.counters.modified}{' '}
                rewritten · {raw.counters.dropped} dropped ·{' '}
                {raw.counters.truncated} shortened
              </Text>
              <Text style={styles.meta}>
                {raw.counters.protectedLines} protected ·{' '}
                {raw.counters.rejected} refused · {raw.counters.timedOut} timed
                out · {raw.counters.failed} failed
              </Text>
              {raw.recent
                .slice(-5)
                .reverse()
                .map((entry, index) => (
                  <Text key={`${entry.timestamp}-${index}`} style={styles.meta}>
                    {entry.command} · {entry.outcome}
                    {entry.originalHash
                      ? ` · ${entry.originalHash}→${entry.resultHash ?? '—'}`
                      : ''}
                  </Text>
                ))}
              <Action
                label={
                  rawSuspended
                    ? 'Raw add-ons suspended - allow again'
                    : 'Reconnect without raw add-ons'
                }
                danger={!rawSuspended}
                styles={styles}
                onPress={() => {
                  if (rawSuspended) addonRawMiddleware.resume();
                  else addonRawMiddleware.suspend();
                  setRawSuspended(addonRawMiddleware.isSuspended());
                }}
              />
            </>
          ) : null}

          <Text style={styles.section}>Addon controls</Text>
          {props.onPreviewDisplay ? (
            <>
              <Action
                label={previewing ? 'Previewing…' : 'Preview message display'}
                onPress={previewDisplay}
                disabled={previewing}
                styles={styles}
              />
              {preview ? (
                <View style={styles.previewBox}>
                  <Text style={styles.cardTitle}>Display preview result</Text>
                  <Text style={styles.body}>
                    {preview.matched === 0
                      ? 'No irc.message subscription matched the sample event.'
                      : `${preview.delivered} handler(s) ran; ${preview.failed} failed.`}
                  </Text>
                  {preview.hideDefaultRequestedBy.length > 0 ? (
                    <Text style={styles.meta}>Default line: hidden</Text>
                  ) : (
                    <Text style={styles.meta}>Default line: shown</Text>
                  )}
                  {preview.transformations.map((item, index) => (
                    <View key={`${item.addonId}-${index}`}>
                      <Text style={styles.meta}>
                        Replacement {index + 1}
                        {item.result.style?.role
                          ? ` · ${item.result.style.role}`
                          : ''}
                        {item.result.routeTo
                          ? ` · ${item.result.routeTo.kind}${item.result.routeTo.target ? `:${item.result.routeTo.target}` : ''}`
                          : ''}
                      </Text>
                      <Text style={styles.previewText}>
                        {item.result.replacement}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}
          <Action
            label={props.enabled ? 'Disable addon' : 'Enable addon'}
            onPress={() => props.onSetEnabled(!props.enabled)}
            styles={styles}
          />
          <Action
            label="Review source"
            onPress={props.onReviewSource}
            styles={styles}
          />
          {props.onExportSource ? (
            <Action
              label="Export source"
              onPress={props.onExportSource}
              styles={styles}
            />
          ) : null}
          {props.onExportDiagnostics ? (
            <Action
              label="Export recovery log"
              onPress={props.onExportDiagnostics}
              styles={styles}
            />
          ) : null}
          {props.onRollback ? (
            <Action
              label="Roll back to previous version"
              onPress={props.onRollback}
              styles={styles}
            />
          ) : null}
          <Action
            label="Uninstall addon"
            danger
            onPress={confirmUninstall}
            styles={styles}
          />
        </ScrollView>
      </ModalSafeArea>
    </Modal>
  );
};

const Action = ({ label, onPress, danger, disabled, styles }: any) => (
  <TouchableOpacity
    style={[
      styles.action,
      danger && styles.dangerAction,
      disabled && styles.disabledAction,
    ]}
    onPress={onPress}
    disabled={disabled}
  >
    <Text style={[styles.actionText, danger && styles.dangerText]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: { color: colors.text, fontSize: 20, fontWeight: '700' },
    link: { color: colors.primary, fontWeight: '600' },
    meta: { color: colors.textSecondary, fontSize: 12 },
    content: { padding: 16, gap: 10 },
    section: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '700',
      marginTop: 8,
    },
    recoveryBox: {
      backgroundColor: colors.surface,
      borderLeftColor: colors.warning,
      borderLeftWidth: 4,
      borderRadius: 8,
      padding: 12,
    },
    recoveryTitle: { color: colors.warning, fontWeight: '700' },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      gap: 5,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
    },
    cardTitle: { color: colors.text, fontWeight: '600', flex: 1 },
    body: { color: colors.text, lineHeight: 20 },
    granted: { color: colors.success, fontSize: 11, fontWeight: '700' },
    denied: { color: colors.warning, fontSize: 11, fontWeight: '700' },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
    action: {
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 7,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    actionText: { color: colors.primary, fontWeight: '600' },
    dangerAction: { borderColor: colors.error },
    dangerText: { color: colors.error },
    disabledAction: { opacity: 0.5 },
    previewBox: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      gap: 5,
    },
    previewText: { color: colors.text, marginTop: 3 },
  });
