/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useMemo } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useTheme } from '../hooks/useTheme';
import { useCallStore } from '../stores/callStore';
import { webRtcCallService } from '../services/WebRTCCallService';

export function WebRTCCallModal() {
  const { colors } = useTheme();
  const {
    phase,
    mediaType,
    peerNick,
    statusText,
    localStream,
    remoteStream,
    direction,
    micMuted,
    cameraEnabled,
    usingRelay,
  } = useCallStore();

  const visible = phase !== 'idle';
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
    title: {
      color: '#f5f7fa',
      fontSize: 24,
      fontWeight: '800',
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
  }), [usingRelay, colors.text]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => webRtcCallService.hangUp()}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{mediaType === 'video' ? 'Video Call' : 'Audio Call'}</Text>
            <Text style={styles.subtitle}>
              {peerNick || 'Unknown peer'} · {statusText || (direction === 'incoming' ? 'Incoming call' : 'Connecting')}
            </Text>
            <View style={styles.relayBadge}>
              <Text style={styles.relayText}>{usingRelay ? 'Relay ready' : 'Direct WebRTC'}</Text>
            </View>
          </View>

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
        </View>
      </View>
    </Modal>
  );
}
