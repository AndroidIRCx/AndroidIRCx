import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { banService, PredefinedReason } from '../services/BanService';
import { useTheme } from '../hooks/useTheme';

interface KickBanReasonsScreenProps {
  navigation: any;
  route: any;
}

const KickBanReasonsScreen: React.FC<KickBanReasonsScreenProps> = () => {
  const { colors } = useTheme();
  const [reasons, setReasons] = useState<PredefinedReason[]>([]);
  const [newReason, setNewReason] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [loading, setLoading] = useState(true);
  const styles = createStyles(colors);

  useEffect(() => {
    loadReasons();
  }, []);

  const loadReasons = async () => {
    setLoading(true);
    // Initialize service to load from storage
    await banService.initialize();
    const loadedReasons = banService.getPredefinedReasons();
    setReasons(loadedReasons);
    setLoading(false);
  };

  const addReason = async () => {
    if (!newReason.trim()) {
      Alert.alert('Error', 'Please enter a reason to add.');
      return;
    }

    const newReasonObj: PredefinedReason = {
      id: `custom_${Date.now()}`,
      text: newReason.trim(),
    };

    const updatedReasons = [...reasons, newReasonObj];
    setReasons(updatedReasons);
    await banService.setPredefinedReasons(updatedReasons);
    setNewReason('');
  };

  const deleteReason = (id: string) => {
    Alert.alert(
      'Delete Reason',
      'Are you sure you want to delete this reason?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedReasons = reasons.filter(reason => reason.id !== id);
            setReasons(updatedReasons);
            await banService.setPredefinedReasons(updatedReasons);
          },
        },
      ],
    );
  };

  const startEditing = (reason: PredefinedReason) => {
    setEditingId(reason.id);
    setEditText(reason.text);
  };

  const saveEdit = async () => {
    if (!editText.trim()) {
      Alert.alert('Error', 'Please enter a reason text.');
      return;
    }

    const updatedReasons = reasons.map(reason =>
      reason.id === editingId ? { ...reason, text: editText.trim() } : reason,
    );

    setReasons(updatedReasons);
    await banService.setPredefinedReasons(updatedReasons);
    setEditingId(null);
    setEditText('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const resetToDefaults = () => {
    Alert.alert(
      'Reset to Defaults',
      'Are you sure you want to reset to default reasons? This will remove all custom reasons.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await banService.resetToDefaultReasons();
            const defaultReasons = banService.getPredefinedReasons();
            setReasons(defaultReasons);
          },
        },
      ],
    );
  };

  const moveReasonUp = async (index: number) => {
    if (index === 0) return; // Already at top

    const updatedReasons = [...reasons];
    [updatedReasons[index], updatedReasons[index - 1]] = [
      updatedReasons[index - 1],
      updatedReasons[index],
    ];

    setReasons(updatedReasons);
    await banService.setPredefinedReasons(updatedReasons);
  };

  const moveReasonDown = async (index: number) => {
    if (index === reasons.length - 1) return; // Already at bottom

    const updatedReasons = [...reasons];
    [updatedReasons[index], updatedReasons[index + 1]] = [
      updatedReasons[index + 1],
      updatedReasons[index],
    ];

    setReasons(updatedReasons);
    await banService.setPredefinedReasons(updatedReasons);
  };

  const renderReason = ({
    item,
    index,
  }: {
    item: PredefinedReason;
    index: number;
  }) => (
    <View style={styles.reasonItem}>
      {editingId === item.id ? (
        <View style={styles.editContainer}>
          <TextInput
            style={styles.editInput}
            value={editText}
            onChangeText={setEditText}
            placeholderTextColor={colors.inputPlaceholder}
            autoFocus
          />
          <View style={styles.editButtons}>
            <TouchableOpacity style={styles.saveButton} onPress={saveEdit}>
              <Text style={styles.buttonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={cancelEdit}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.reasonContent}>
          <Text style={styles.reasonText}>{item.text}</Text>
          <View style={styles.reasonActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.moveButton]}
              onPress={() => moveReasonUp(index)}
              disabled={index === 0}
            >
              <Text style={styles.actionButtonText}>↑</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.moveButton]}
              onPress={() => moveReasonDown(index)}
              disabled={index === reasons.length - 1}
            >
              <Text style={styles.actionButtonText}>↓</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={() => startEditing(item)}
            >
              <Text style={styles.actionButtonText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => deleteReason(item.id)}
            >
              <Text style={styles.actionButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Predefined Kick/Ban Reasons</Text>

      <View style={styles.addContainer}>
        <TextInput
          style={styles.addInput}
          value={newReason}
          onChangeText={setNewReason}
          placeholder="Enter new reason..."
          placeholderTextColor={colors.inputPlaceholder}
        />
        <TouchableOpacity style={styles.addButton} onPress={addReason}>
          <Text style={styles.buttonText}>Add Reason</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={reasons}
        renderItem={renderReason}
        keyExtractor={item => item.id}
        style={styles.list}
        scrollEnabled={false}
      />

      <TouchableOpacity style={styles.resetButton} onPress={resetToDefaults}>
        <Text style={styles.resetButtonText}>Reset to Defaults</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
      backgroundColor: colors.background,
    },
    centered: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      color: colors.text,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 20,
      textAlign: 'center',
      color: colors.text,
    },
    addContainer: {
      flexDirection: 'row',
      marginBottom: 20,
    },
    addInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 5,
      padding: 10,
      marginRight: 10,
      backgroundColor: colors.inputBackground,
      color: colors.inputText,
    },
    addButton: {
      backgroundColor: colors.buttonPrimary,
      paddingHorizontal: 15,
      paddingVertical: 10,
      borderRadius: 5,
      justifyContent: 'center',
    },
    list: {
      flex: 1,
    },
    reasonItem: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 5,
      padding: 15,
      marginBottom: 10,
    },
    reasonContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    reasonText: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
    },
    reasonActions: {
      flexDirection: 'row',
    },
    actionButton: {
      marginLeft: 5,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 3,
    },
    moveButton: {
      backgroundColor: colors.buttonSecondary,
    },
    editButton: {
      backgroundColor: colors.accent,
    },
    deleteButton: {
      backgroundColor: colors.error,
    },
    actionButtonText: {
      color: colors.onPrimary,
      fontSize: 12,
    },
    editContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    editInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 5,
      padding: 10,
      marginRight: 10,
      backgroundColor: colors.inputBackground,
      color: colors.inputText,
    },
    editButtons: {
      flexDirection: 'row',
    },
    saveButton: {
      backgroundColor: colors.accent,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 3,
      marginRight: 5,
    },
    cancelButton: {
      backgroundColor: colors.error,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 3,
    },
    buttonText: {
      color: colors.onPrimary,
      fontWeight: 'bold',
    },
    resetButton: {
      backgroundColor: colors.warning,
      padding: 15,
      borderRadius: 5,
      alignItems: 'center',
      marginTop: 20,
      marginBottom: 40,
    },
    resetButtonText: {
      color: colors.onPrimary,
      fontWeight: 'bold',
      fontSize: 16,
    },
  });

export default KickBanReasonsScreen;
