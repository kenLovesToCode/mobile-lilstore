import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import React, { useRef, useState, useSyncExternalStore } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AdminShell } from "@/components/ui/admin-shell";
import { ContextualEditorSurface } from "@/components/ui/contextual-editor-surface";
import { MotionPressable } from "@/components/ui/motion-pressable";
import { SoftCard } from "@/components/ui/soft-card";
import { StatusChip } from "@/components/ui/status-chip";
import {
  clearAdminSession,
  getActiveOwner,
  getAdminSession,
  subscribeToAdminSession,
} from "@/domain/services/admin-session";
import {
  restoreFullBackupFromJsonFile,
  type BackupRestorePreview,
  type BackupRestoreReceipt,
  validateBackupFromJsonFile,
} from "@/domain/services/backup-service";
import { adminDesignTokens, useAdminPalette } from "@/tamagui";

type SelectedBackupFile = {
  name: string;
  uri: string;
};

export default function AdminRestoreBackupScreen() {
  const palette = useAdminPalette();
  const session = useSyncExternalStore(
    subscribeToAdminSession,
    getAdminSession,
    () => null,
  );
  const activeOwner = useSyncExternalStore(
    subscribeToAdminSession,
    getActiveOwner,
    () => null,
  );
  const [selectedFile, setSelectedFile] = useState<SelectedBackupFile | null>(null);
  const [preview, setPreview] = useState<BackupRestorePreview | null>(null);
  const [receipt, setReceipt] = useState<BackupRestoreReceipt | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPickingFile, setIsPickingFile] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [hasConfirmedReplaceAll, setHasConfirmedReplaceAll] = useState(false);
  const pickerLockRef = useRef(false);
  const restoreLockRef = useRef(false);

  function resetRestoreDraft() {
    setSelectedFile(null);
    setPreview(null);
    setReceipt(null);
    setErrorMessage(null);
    setHasConfirmedReplaceAll(false);
  }

  async function onPickBackupFile() {
    if (pickerLockRef.current || isPickingFile || isValidating || isRestoring) {
      return;
    }

    pickerLockRef.current = true;
    setIsPickingFile(true);
    setErrorMessage(null);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      const pickedFile = {
        name: asset.name,
        uri: asset.uri,
      };
      setSelectedFile(pickedFile);
      setHasConfirmedReplaceAll(false);
      setReceipt(null);
      setPreview(null);
      setIsValidating(true);

      const validationResult = await validateBackupFromJsonFile({
        fileUri: pickedFile.uri,
      });
      if (!validationResult.ok) {
        setErrorMessage(validationResult.error.message);
        return;
      }

      setErrorMessage(null);
      setPreview(validationResult.value);
    } catch {
      setErrorMessage("We couldn't open the backup picker. Please retry.");
    } finally {
      setIsValidating(false);
      setIsPickingFile(false);
      pickerLockRef.current = false;
    }
  }

  async function onRestoreBackup() {
    if (
      restoreLockRef.current ||
      isRestoring ||
      isPickingFile ||
      isValidating ||
      !selectedFile ||
      !preview
    ) {
      return;
    }

    if (!hasConfirmedReplaceAll) {
      setErrorMessage("Confirm replace-all restore before continuing.");
      return;
    }

    restoreLockRef.current = true;
    setIsRestoring(true);
    setErrorMessage(null);

    try {
      const result = await restoreFullBackupFromJsonFile({
        fileUri: selectedFile.uri,
      });

      if (!result.ok) {
        setErrorMessage(result.error.message);
        return;
      }

      setReceipt(result.value);
      setErrorMessage(null);
      clearAdminSession();
      router.replace("/login");
    } finally {
      setIsRestoring(false);
      restoreLockRef.current = false;
    }
  }

  return (
    <AdminShell
      adminUsername={session?.username}
      eyebrow="Secondary workspace"
      ownerName={activeOwner?.name ?? null}
      subtitle="Validate a backup first, then run a replace-all restore from a deliberate destructive surface with explicit confirmation."
      title="Restore Full Backup"
    >
      <View style={styles.content}>
        <SoftCard style={styles.calloutCard} tone="warning">
          <Text selectable style={[styles.calloutTitle, { color: palette.warningText }]}>
            Replace-all warning
          </Text>
          <Text selectable style={[styles.calloutBody, { color: palette.warningText }]}>
            Restoring a backup replaces every local record in one atomic flow. Validation, confirmation, and single-flight locking stay intact here.
          </Text>
          <View style={styles.chipRow}>
            <StatusChip tone="warning">Destructive</StatusChip>
            <StatusChip tone="info">Validation required</StatusChip>
          </View>
        </SoftCard>

        <ContextualEditorSurface
          description="Pick a local JSON backup, validate it, and keep the preview visible before you can continue."
          eyebrow="Backup source"
          footer={
            <View style={styles.actionRow}>
              <MotionPressable
                accessibilityLabel="Pick Backup File"
                disabled={isPickingFile || isValidating || isRestoring}
                onPress={() => void onPickBackupFile()}
                tone="secondary"
              >
                {isPickingFile
                  ? "Opening Picker..."
                  : isValidating
                    ? "Validating Backup..."
                    : "Pick Backup File"}
              </MotionPressable>
              {selectedFile ? (
                <MotionPressable
                  accessibilityLabel="Discard selected backup file"
                  disabled={isRestoring}
                  onPress={resetRestoreDraft}
                  tone="ghost"
                >
                  Discard selection
                </MotionPressable>
              ) : null}
            </View>
          }
          title="Choose backup file"
        >
          {selectedFile ? (
            <SoftCard style={styles.detailCard} testID="restore-selected-file" tone="subtle">
              <Text selectable style={[styles.detailTitle, { color: palette.textStrong }]}>
                Selected File
              </Text>
              <Text selectable style={[styles.detailBody, { color: palette.textStrong }]}>
                {selectedFile.name}
              </Text>
              <Text selectable style={[styles.detailBody, { color: palette.text }]}>
                {selectedFile.uri}
              </Text>
            </SoftCard>
          ) : (
            <Text selectable style={[styles.helperText, { color: palette.text }]}>
              No file selected yet. Choose a local JSON backup to begin validation.
            </Text>
          )}
        </ContextualEditorSurface>

        {preview ? (
          <SoftCard style={styles.previewCard} testID="restore-preview" tone="info">
            <Text selectable style={[styles.previewTitle, { color: palette.textStrong }]}>
              Validated Backup Summary
            </Text>
            <Text selectable style={[styles.previewText, { color: palette.text }]}>
              Schema version: {preview.schemaVersion}
            </Text>
            <Text selectable style={[styles.previewText, { color: palette.text }]}>
              Exported at: {preview.exportedAt}
            </Text>
            <Text selectable style={[styles.previewText, { color: palette.text }]}>
              Admin: {preview.counts.admin}
            </Text>
            <Text selectable style={[styles.previewText, { color: palette.text }]}>
              App Secret: {preview.counts.appSecret}
            </Text>
            <Text selectable style={[styles.previewText, { color: palette.text }]}>
              Owners: {preview.counts.storeOwner}
            </Text>
            <Text selectable style={[styles.previewText, { color: palette.text }]}>
              Products: {preview.counts.product}
            </Text>
            <Text selectable style={[styles.previewText, { color: palette.text }]}>
              Shoppers: {preview.counts.shopper}
            </Text>
            <Text selectable style={[styles.previewText, { color: palette.text }]}>
              Shopping List Items: {preview.counts.shoppingListItem}
            </Text>
            <Text selectable style={[styles.previewText, { color: palette.text }]}>
              Assorted Items: {preview.counts.shoppingListAssortedItem}
            </Text>
            <Text selectable style={[styles.previewText, { color: palette.text }]}>
              Assorted Members: {preview.counts.shoppingListAssortedMember}
            </Text>
            <Text selectable style={[styles.previewText, { color: palette.text }]}>
              Purchases: {preview.counts.purchase}
            </Text>
            <Text selectable style={[styles.previewText, { color: palette.text }]}>
              Purchase Line Items: {preview.counts.purchaseLineItem}
            </Text>
            <Text selectable style={[styles.previewText, { color: palette.text }]}>
              Payments: {preview.counts.payment}
            </Text>
          </SoftCard>
        ) : null}

        <ContextualEditorSurface
          description="The destructive action remains disabled until validation finishes and the replace-all confirmation is checked."
          eyebrow="Restore execution"
          footer={
            receipt ? (
              <SoftCard style={styles.detailCard} testID="backup-restore-success" tone="success">
                <Text selectable style={[styles.detailTitle, { color: palette.successText }]}>
                  Restore complete
                </Text>
                <Text selectable style={[styles.detailBody, { color: palette.successText }]}>
                  Restored at: {receipt.restoredAt}
                </Text>
                <Text selectable style={[styles.detailBody, { color: palette.successText }]}>
                  Schema version: {receipt.schemaVersion}
                </Text>
              </SoftCard>
            ) : null
          }
          title="Confirm and restore"
          tone="danger"
        >
          <MotionPressable
            accessibilityLabel="Confirm Replace All Restore"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: hasConfirmedReplaceAll }}
            onPress={() => setHasConfirmedReplaceAll((current) => !current)}
            style={[
              styles.confirmRow,
              {
                backgroundColor: palette.surface,
                borderColor: hasConfirmedReplaceAll ? palette.dangerBorder : palette.border,
              },
            ]}
            tone="secondary"
          >
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: hasConfirmedReplaceAll
                    ? palette.dangerSurface
                    : palette.canvasAlt,
                  borderColor: hasConfirmedReplaceAll
                    ? palette.dangerBorder
                    : palette.border,
                },
              ]}
            >
              {hasConfirmedReplaceAll ? (
                <Text style={[styles.checkboxTick, { color: palette.dangerText }]}>✓</Text>
              ) : null}
            </View>
            <Text selectable style={[styles.confirmText, { color: palette.textStrong }]}>
              I understand this permanently replaces all local data with the backup.
            </Text>
          </MotionPressable>

          <View style={styles.actionRow}>
            <MotionPressable
              accessibilityLabel="Run Restore"
              disabled={
                isRestoring ||
                isPickingFile ||
                isValidating ||
                !preview ||
                !selectedFile ||
                !hasConfirmedReplaceAll
              }
              onPress={() => void onRestoreBackup()}
              tone="danger"
            >
              {isRestoring ? "Restoring Backup..." : "Run Restore"}
            </MotionPressable>
            <StatusChip
              tone={
                isRestoring
                  ? "warning"
                  : hasConfirmedReplaceAll && preview
                    ? "danger"
                    : "neutral"
              }
            >
              {isRestoring
                ? "Restore running"
                : hasConfirmedReplaceAll && preview
                  ? "Ready to replace all"
                  : "Confirmation pending"}
            </StatusChip>
          </View>
        </ContextualEditorSurface>

        {errorMessage ? (
          <SoftCard style={styles.errorCard} tone="danger">
            <Text selectable style={[styles.detailTitle, { color: palette.dangerText }]}>
              Restore failed
            </Text>
            <Text selectable style={[styles.detailBody, { color: palette.dangerText }]}>
              {errorMessage}
            </Text>
            <Text selectable style={[styles.detailBody, { color: palette.dangerText }]}>
              Choose a backup file and retry.
            </Text>
          </SoftCard>
        ) : null}
      </View>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: adminDesignTokens.space.sm,
  },
  calloutBody: {
    ...adminDesignTokens.typography.body,
  },
  calloutCard: {
    paddingHorizontal: adminDesignTokens.space.md,
    paddingVertical: adminDesignTokens.space.md,
  },
  calloutTitle: {
    ...adminDesignTokens.typography.cardTitle,
  },
  checkbox: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  checkboxTick: {
    fontSize: 14,
    fontWeight: "800",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: adminDesignTokens.space.xs,
  },
  confirmRow: {
    alignItems: "center",
    borderRadius: adminDesignTokens.radius.card,
    borderWidth: 1,
    flexDirection: "row",
    gap: adminDesignTokens.space.sm,
    paddingHorizontal: adminDesignTokens.space.md,
    paddingVertical: adminDesignTokens.space.md,
  },
  confirmText: {
    ...adminDesignTokens.typography.body,
    flex: 1,
  },
  content: {
    gap: adminDesignTokens.space.md,
  },
  detailBody: {
    ...adminDesignTokens.typography.body,
  },
  detailCard: {
    paddingHorizontal: adminDesignTokens.space.md,
    paddingVertical: adminDesignTokens.space.md,
  },
  detailTitle: {
    ...adminDesignTokens.typography.cardTitle,
  },
  errorCard: {
    paddingHorizontal: adminDesignTokens.space.md,
    paddingVertical: adminDesignTokens.space.md,
  },
  helperText: {
    ...adminDesignTokens.typography.body,
  },
  previewCard: {
    paddingHorizontal: adminDesignTokens.space.md,
    paddingVertical: adminDesignTokens.space.md,
  },
  previewText: {
    ...adminDesignTokens.typography.body,
  },
  previewTitle: {
    ...adminDesignTokens.typography.cardTitle,
  },
});
