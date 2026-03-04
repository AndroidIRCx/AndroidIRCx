/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RTCView } from 'react-native-webrtc';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useCallStore } from '../stores/callStore';
import { webRtcCallService } from '../services/WebRTCCallService';
import { notificationService } from '../services/NotificationService';
import { settingsService } from '../services/SettingsService';

const OVERLAY_MARGIN = 12;
const VIDEO_ASPECT_RATIO = 1.35;

interface WebRTCCallModalProps {
  activeTab?: {
    type?: string;
    name?: string;
    networkId?: string;
  } | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function WebRTCCallModal({ activeTab }: WebRTCCallModalProps) {
  const {
    phase,
    mediaType,
    peerNick,
    networkId,
    statusText,
    localStream,
    remoteStream,
    direction,
    micMuted,
    cameraEnabled,
    usingRelay,
    minimized,
    overlayX,
    overlayY,
    videoOverlayWidth,
  } = useCallStore();

  const [showOnlyOnActiveQuery, setShowOnlyOnActiveQuery] = useState(false);
  const [showCallNotification, setShowCallNotification] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const value = await settingsService.getSetting('callMinimizedOnlyOnActiveQuery', false);
      if (mounted) {
        setShowOnlyOnActiveQuery(Boolean(value));
      }
    };

    load();
    const unsubscribe = settingsService.onSettingChange<boolean>('callMinimizedOnlyOnActiveQuery', (value) => {
      setShowOnlyOnActiveQuery(Boolean(value));
    });
    const unsubscribeNotification = settingsService.onSettingChange<boolean>('showCallNotification', (value) => {
      setShowCallNotification(Boolean(value));
    });

    settingsService.getSetting('showCallNotification', true).then((value) => {
      if (mounted) {
        setShowCallNotification(Boolean(value));
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
      unsubscribeNotification();
    };
  }, []);

  useEffect(() => {
    const shouldShowNotification = phase !== 'idle' && phase !== 'ended' && phase !== 'error';

    if (!showCallNotification || !shouldShowNotification || !peerNick) {
      notificationService.cancelOngoingCallNotification().catch(() => undefined);
      return;
    }

    notificationService.showOngoingCallNotification({
      peerNick,
      mediaType,
      statusText: statusText || 'Connecting...',
      network: networkId,
      minimized,
    }).catch(() => undefined);

    return () => {
      if (phase === 'idle' || phase === 'ended' || phase === 'error') {
        notificationService.cancelOngoingCallNotification().catch(() => undefined);
      }
    };
  }, [mediaType, minimized, networkId, peerNick, phase, showCallNotification, statusText]);

  const visible = phase !== 'idle';
  const modalVisible = visible && !minimized;
  const canMinimize = phase !== 'incoming' && phase !== 'idle' && phase !== 'ended' && phase !== 'error';

  const activeQueryMatchesPeer = Boolean(
    activeTab &&
    activeTab.type === 'query' &&
    activeTab.networkId === networkId &&
    activeTab.name?.toLowerCase() === peerNick?.toLowerCase()
  );
  const shouldRenderMinimizedGlobally = !showOnlyOnActiveQuery || activeQueryMatchesPeer;

  const window = Dimensions.get('window');
  const overlayWidth = mediaType === 'video'
    ? clamp(videoOverlayWidth, 132, Math.min(260, window.width - 24))
    : Math.min(240, window.width - 24);
  const overlayHeight = mediaType === 'video' ? overlayWidth * VIDEO_ASPECT_RATIO : 70;
  const maxOverlayX = Math.max(OVERLAY_MARGIN, window.width - overlayWidth - OVERLAY_MARGIN);
  const maxOverlayY = Math.max(OVERLAY_MARGIN, window.height - overlayHeight - 120);
  const boundedX = clamp(overlayX, OVERLAY_MARGIN, maxOverlayX);
  const boundedY = clamp(overlayY, OVERLAY_MARGIN, maxOverlayY);

  const dragStartRef = useRef({ x: boundedX, y: boundedY });
  const resizeStartRef = useRef({ width: overlayWidth });

  const moveResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => minimized,
    onMoveShouldSetPanResponder: (_, gestureState) =>
      minimized && (Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4),
    onPanResponderGrant: () => {
      dragStartRef.current = { x: boundedX, y: boundedY };
    },
    onPanResponderMove: (_, gestureState) => {
      webRtcCallService.updateOverlayPosition(
        clamp(dragStartRef.current.x + gestureState.dx, OVERLAY_MARGIN, maxOverlayX),
        clamp(dragStartRef.current.y + gestureState.dy, OVERLAY_MARGIN, maxOverlayY)
      );
    },
    onPanResponderRelease: (_, gestureState) => {
      const nextY = clamp(dragStartRef.current.y + gestureState.dy, OVERLAY_MARGIN, maxOverlayY);
      webRtcCallService.snapOverlayToEdge(window.width, overlayWidth, nextY);
    },
  }), [boundedX, boundedY, maxOverlayX, maxOverlayY, minimized]);

  const resizeResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => minimized && mediaType === 'video',
    onMoveShouldSetPanResponder: (_, gestureState) =>
      minimized && mediaType === 'video' && Math.abs(gestureState.dx) > 2,
    onPanResponderGrant: () => {
      resizeStartRef.current = { width: overlayWidth };
    },
    onPanResponderMove: (_, gestureState) => {
      webRtcCallService.updateVideoOverlayWidth(
        clamp(resizeStartRef.current.width + gestureState.dx, 132, Math.min(260, window.width - 24))
      );
    },
  }), [mediaType, minimized, overlayWidth, window.width]);

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: '#101820',
      justifyContent: 'center',
      padding: 16,
    },
    card: {
      flex: 1,
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: '#16212b',
      borderWidth: 1,
      borderColor: '#2b3b49',
    },
    header: {
      padding: 18,
      gap: 6,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    title: {
      color: '#f5f7fa',
      fontSize: 24,
      fontWeight: '800',
      flex: 1,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 10,
    },
    headerButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#243340',
    },
    subtitle: {
      color: '#9db0be',
      fontSize: 14,
    },
    relayBadge: {
      alignSelf: 'flex-start',
      marginTop: 6,
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: usingRelay ? '#194d32' : '#2a3540',
    },
    relayText: {
      color: '#f5f7fa',
      fontSize: 12,
      fontWeight: '700',
    },
    stage: {
      flex: 1,
      backgroundColor: '#0b1015',
      justifyContent: 'center',
      alignItems: 'center',
    },
    remoteVideo: {
      width: '100%',
      height: '100%',
    },
    localPreview: {
      position: 'absolute',
      right: 16,
      top: 16,
      width: 120,
      height: 180,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#ffffff30',
      backgroundColor: '#1f2b36',
    },
    placeholderTitle: {
      color: '#f5f7fa',
      fontSize: 20,
      fontWeight: '700',
    },
    placeholderText: {
      color: '#9db0be',
      fontSize: 14,
      marginTop: 6,
    },
    controls: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 16,
      padding: 20,
      backgroundColor: '#13202a',
    },
    button: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#243340',
    },
    dangerButton: {
      backgroundColor: '#c74343',
    },
    answerButton: {
      backgroundColor: '#22824c',
    },
    minimizedLayer: {
      position: 'absolute',
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    },
    audioChip: {
      position: 'absolute',
      width: overlayWidth,
      minHeight: overlayHeight,
      borderRadius: 18,
      backgroundColor: '#13202a',
      borderWidth: 1,
      borderColor: '#274255',
      paddingHorizontal: 14,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 10,
    },
    audioAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: '#1f3342',
      alignItems: 'center',
      justifyContent: 'center',
    },
    audioInfo: {
      flex: 1,
    },
    audioTitle: {
      color: '#f5f7fa',
      fontSize: 14,
      fontWeight: '700',
    },
    audioStatus: {
      color: '#9db0be',
      fontSize: 12,
      marginTop: 2,
    },
    miniAction: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#213645',
    },
    miniDanger: {
      backgroundColor: '#c74343',
    },
    videoOverlay: {
      position: 'absolute',
      width: overlayWidth,
      height: overlayHeight,
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: '#0b1015',
      borderWidth: 1,
      borderColor: '#274255',
      shadowColor: '#000',
      shadowOpacity: 0.28,
      shadowRadius: 12,
      elevation: 12,
    },
    videoOverlayTop: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 8,
      zIndex: 2,
    },
    videoLabel: {
      backgroundColor: '#00000088',
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    videoLabelText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '700',
    },
    videoMiniActionGroup: {
      flexDirection: 'row',
      gap: 8,
    },
    videoMiniButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: '#00000088',
      alignItems: 'center',
      justifyContent: 'center',
    },
    videoMiniDanger: {
      backgroundColor: '#c74343dd',
    },
    videoPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#111a21',
      paddingHorizontal: 12,
    },
    videoPlaceholderTitle: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '700',
    },
    videoPlaceholderStatus: {
      color: '#d7e1e8',
      fontSize: 11,
      marginTop: 4,
      textAlign: 'center',
    },
    resizeHandle: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#00000088',
      borderTopLeftRadius: 12,
      zIndex: 3,
    },
    scopedBadge: {
      position: 'absolute',
      right: 12,
      top: 92,
      minWidth: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: '#13202a',
      borderWidth: 1,
      borderColor: '#274255',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 8,
    },
    scopedBadgeDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: mediaType === 'video' ? '#e45353' : '#2fb36c',
    },
    scopedBadgeText: {
      color: '#f5f7fa',
      fontSize: 10,
      fontWeight: '700',
      marginTop: 4,
    },
  }), [mediaType, overlayHeight, overlayWidth, usingRelay, window.width]);

  const renderFullscreenStage = () => (
    <View style={styles.stage}>
      {mediaType === 'video' && remoteStream ? (
        <RTCView streamURL={remoteStream.toURL()} style={styles.remoteVideo} objectFit="cover" />
      ) : (
        <>
          <Text style={styles.placeholderTitle}>{peerNick || 'Unknown peer'}</Text>
          <Text style={styles.placeholderText}>
            {mediaType === 'video' ? 'Waiting for remote video...' : 'Audio call in progress'}
          </Text>
        </>
      )}
      {mediaType === 'video' && localStream && (
        <View style={styles.localPreview}>
          <RTCView streamURL={localStream.toURL()} style={styles.remoteVideo} objectFit="cover" mirror />
        </View>
      )}
    </View>
  );

  const renderControls = () => (
    <View style={styles.controls}>
      {phase === 'incoming' ? (
        <>
          <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={() => webRtcCallService.declineIncomingCall()}>
            <Icon name="phone-slash" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.answerButton]} onPress={() => webRtcCallService.acceptIncomingCall()}>
            <Icon name={mediaType === 'video' ? 'video' : 'phone'} size={18} color="#fff" />
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TouchableOpacity style={styles.button} onPress={() => webRtcCallService.toggleMute()}>
            <Icon name={micMuted ? 'microphone-slash' : 'microphone'} size={18} color="#fff" />
          </TouchableOpacity>
          {mediaType === 'video' && (
            <TouchableOpacity style={styles.button} onPress={() => webRtcCallService.toggleCamera()}>
              <Icon name={cameraEnabled ? 'video' : 'video-slash'} size={18} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={() => webRtcCallService.hangUp()}>
            <Icon name="phone-slash" size={18} color="#fff" />
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  return (
    <>
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => webRtcCallService.hangUp()}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.header}>
              <View style={styles.headerRow}>
                <Text style={styles.title}>{mediaType === 'video' ? 'Video Call' : 'Audio Call'}</Text>
                {canMinimize && (
                  <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.headerButton} onPress={() => webRtcCallService.minimizeCall()}>
                      <Icon name="window-minimize" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              <Text style={styles.subtitle}>
                {peerNick || 'Unknown peer'} · {statusText || (direction === 'incoming' ? 'Incoming call' : 'Connecting')}
              </Text>
              <View style={styles.relayBadge}>
                <Text style={styles.relayText}>{usingRelay ? 'Relay ready' : 'Direct WebRTC'}</Text>
              </View>
            </View>

            {renderFullscreenStage()}
            {renderControls()}
          </View>
        </View>
      </Modal>

      {visible && minimized && shouldRenderMinimizedGlobally && (
        <View style={styles.minimizedLayer} pointerEvents="box-none">
          {mediaType === 'video' ? (
            <View
              style={[styles.videoOverlay, { left: boundedX, top: boundedY }]}
              {...moveResponder.panHandlers}
            >
              <View style={styles.videoOverlayTop}>
                <View style={styles.videoLabel}>
                  <Text style={styles.videoLabelText}>{peerNick || 'Video Call'}</Text>
                </View>
                <View style={styles.videoMiniActionGroup}>
                  <TouchableOpacity style={styles.videoMiniButton} onPress={() => webRtcCallService.restoreCall()}>
                    <Icon name="expand" size={12} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.videoMiniButton, styles.videoMiniDanger]} onPress={() => webRtcCallService.hangUp()}>
                    <Icon name="phone-slash" size={11} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.95} onPress={() => webRtcCallService.restoreCall()}>
                {remoteStream ? (
                  <RTCView streamURL={remoteStream.toURL()} style={styles.remoteVideo} objectFit="cover" />
                ) : (
                  <View style={styles.videoPlaceholder}>
                    <Text style={styles.videoPlaceholderTitle}>{peerNick || 'Video Call'}</Text>
                    <Text style={styles.videoPlaceholderStatus}>{statusText || 'Connecting...'}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.resizeHandle} {...resizeResponder.panHandlers}>
                <Icon name="expand-arrows-alt" size={12} color="#fff" />
              </View>
            </View>
          ) : (
            <View
              style={[styles.audioChip, { left: boundedX, top: boundedY }]}
              {...moveResponder.panHandlers}
            >
              <TouchableOpacity style={styles.audioAvatar} onPress={() => webRtcCallService.restoreCall()}>
                <Icon name={micMuted ? 'microphone-slash' : 'phone'} size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.audioInfo} activeOpacity={0.85} onPress={() => webRtcCallService.restoreCall()}>
                <Text style={styles.audioTitle}>{peerNick || 'Audio Call'}</Text>
                <Text style={styles.audioStatus}>{statusText || 'Call in progress'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.miniAction} onPress={() => webRtcCallService.restoreCall()}>
                <Icon name="expand" size={12} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.miniAction, styles.miniDanger]} onPress={() => webRtcCallService.hangUp()}>
                <Icon name="phone-slash" size={12} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {visible && minimized && !shouldRenderMinimizedGlobally && showOnlyOnActiveQuery && (
        <View style={styles.minimizedLayer} pointerEvents="box-none">
          <TouchableOpacity style={styles.scopedBadge} activeOpacity={0.9} onPress={() => webRtcCallService.restoreCall()}>
            <View style={styles.scopedBadgeDot} />
            <Icon name={mediaType === 'video' ? 'video' : 'phone'} size={16} color="#fff" />
            <Text style={styles.scopedBadgeText}>CALL</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}
