import React, {
  KeyboardEventHandler,
  RefObject,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { isKeyHotkey } from 'is-hotkey';
import { EventType, IContent, MsgType, RelationType, Room } from 'matrix-js-sdk';
import { ReactEditor } from 'slate-react';
import { Transforms, Editor } from 'slate';
import {
  Box,
  Dialog,
  Icon,
  IconButton,
  Icons,
  Line,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  PopOut,
  Scroll,
  Text,
  config,
  toRem,
} from 'folds';
import { spaceUploadSettingsAtom } from '../../state/uploadSettings';

import { useMatrixClient } from '../../hooks/useMatrixClient';
import {
  CustomEditor,
  Toolbar,
  toMatrixCustomHTML,
  toPlainText,
  AUTOCOMPLETE_PREFIXES,
  AutocompletePrefix,
  AutocompleteQuery,
  getAutocompleteQuery,
  getPrevWorldRange,
  resetEditor,
  RoomMentionAutocomplete,
  UserMentionAutocomplete,
  EmoticonAutocomplete,
  createEmoticonElement,
  moveCursor,
  resetEditorHistory,
  customHtmlEqualsPlainText,
  trimCustomHtml,
  isEmptyEditor,
  getBeginCommand,
  trimCommand,
  getMentions,
} from '../../components/editor';
import { EmojiBoard, EmojiBoardTab } from '../../components/emoji-board';
import { UseStateProvider } from '../../components/UseStateProvider';
import {
  TUploadContent,
  encryptFile,
  getImageInfo,
  getMxIdLocalPart,
  mxcUrlToHttp,
} from '../../utils/matrix';
import { useTypingStatusUpdater } from '../../hooks/useTypingStatusUpdater';
import { useFilePicker } from '../../hooks/useFilePicker';
import { useFilePasteHandler } from '../../hooks/useFilePasteHandler';
import { useFileDropZone } from '../../hooks/useFileDrop';
import {
  TUploadItem,
  TUploadMetadata,
  roomIdToMsgDraftAtomFamily,
  roomIdToReplyDraftAtomFamily,
  roomIdToUploadItemsAtomFamily,
  roomUploadAtomFamily,
} from '../../state/room/roomInputDrafts';
import { UploadCardRenderer } from '../../components/upload-card';
import {
  UploadBoard,
  UploadBoardContent,
  UploadBoardHeader,
  UploadBoardImperativeHandlers,
} from '../../components/upload-board';
import {
  Upload,
  UploadStatus,
  UploadSuccess,
  createUploadFamilyObserverAtom,
} from '../../state/upload';
import { getImageUrlBlob, loadImageElement } from '../../utils/dom';
import { safeFile } from '../../utils/mimeTypes';
import { fulfilledPromiseSettledResult } from '../../utils/common';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import {
  getAudioMsgContent,
  getFileMsgContent,
  getImageMsgContent,
  getVideoMsgContent,
} from './msgContent';
import { GifItem } from '../../plugins/gif/types';
import { getMemberDisplayName, getMentionContent, trimReplyFromBody } from '../../utils/room';
import { CommandAutocomplete } from './CommandAutocomplete';
import { CharacterCounter } from '../../components/editor/CharacterCounter';
import { Command, SHRUG, TABLEFLIP, UNFLIP, useCommands } from '../../hooks/useCommands';
import { mobileOrTablet } from '../../utils/user-agent';
import { useElementSizeObserver } from '../../hooks/useElementSizeObserver';
import { ReplyLayout, ThreadIndicator } from '../../components/message';
import { roomToParentsAtom } from '../../state/room/roomToParents';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useImagePackRooms } from '../../hooks/useImagePackRooms';
import { usePowerLevelsContext } from '../../hooks/usePowerLevels';
import colorMXID from '../../../util/colorMXID';
import { useIsDirectRoom } from '../../hooks/useRoom';
import { useAccessiblePowerTagColors, useGetMemberPowerTag } from '../../hooks/useMemberPowerTag';
import { useRoomCreators } from '../../hooks/useRoomCreators';
import { useTheme } from '../../hooks/useTheme';
import { useRoomCreatorsTag } from '../../hooks/useRoomCreatorsTag';
import { usePowerLevelTags } from '../../hooks/usePowerLevelTags';
import { useComposingCheck } from '../../hooks/useComposingCheck';
import { useClientConfig } from '../../hooks/useClientConfig';

interface RoomInputProps {
  editor: Editor;
  fileDropContainerRef: RefObject<HTMLElement>;
  roomId: string;
  room: Room;
  threadId?: string;
  editId?: string;
  setEditId?: (id: string | undefined) => void;
}
export const RoomInput = forwardRef<HTMLDivElement, RoomInputProps>(
  ({ editor, fileDropContainerRef, roomId, room, threadId, editId, setEditId }, ref) => {
    const mx = useMatrixClient();
    const useAuthentication = useMediaAuthentication();
    const [enterForNewline] = useSetting(settingsAtom, 'enterForNewline');
    const [isMarkdown] = useSetting(settingsAtom, 'isMarkdown');
    const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
    const [legacyUsernameColor] = useSetting(settingsAtom, 'legacyUsernameColor');
    const direct = useIsDirectRoom();
    const { hashRouter } = useClientConfig();
    const commands = useCommands(mx, room);
    const pickerBtnRef = useRef<HTMLButtonElement>(null);
    const roomToParents = useAtomValue(roomToParentsAtom);
    const powerLevels = usePowerLevelsContext();
    const creators = useRoomCreators(room);

    const draftKey = threadId ? `${roomId}_thread_${threadId}` : roomId;
    const [msgDraft, setMsgDraft] = useAtom(roomIdToMsgDraftAtomFamily(draftKey));
    const [replyDraft, setReplyDraft] = useAtom(roomIdToReplyDraftAtomFamily(draftKey));
    const replyUserID = replyDraft?.userId;

    const powerLevelTags = usePowerLevelTags(room, powerLevels);
    const creatorsTag = useRoomCreatorsTag();
    const getMemberPowerTag = useGetMemberPowerTag(room, creators, powerLevels);
    const theme = useTheme();
    const accessibleTagColors = useAccessiblePowerTagColors(
      theme.kind,
      creatorsTag,
      powerLevelTags
    );

    const replyPowerTag = replyUserID ? getMemberPowerTag(replyUserID) : undefined;
    const replyPowerColor = replyPowerTag?.color
      ? accessibleTagColors.get(replyPowerTag.color)
      : undefined;
    const replyUsernameColor =
      legacyUsernameColor || direct ? colorMXID(replyUserID ?? '') : replyPowerColor;

    const spaceUploadSettings = useAtomValue(spaceUploadSettingsAtom);
    const [uploadSizeError, setUploadSizeError] = useState<string | null>(null);

    const [uploadBoard, setUploadBoard] = useState(true);
    const [selectedFiles, setSelectedFiles] = useAtom(roomIdToUploadItemsAtomFamily(roomId));
    const uploadFamilyObserverAtom = createUploadFamilyObserverAtom(
      roomUploadAtomFamily,
      selectedFiles.map((f) => f.file)
    );
    const uploadBoardHandlers = useRef<UploadBoardImperativeHandlers>();

    const imagePackRooms: Room[] = useImagePackRooms(roomId, roomToParents);

    const [toolbar, setToolbar] = useSetting(settingsAtom, 'editorToolbar');
    const [autocompleteQuery, setAutocompleteQuery] =
      useState<AutocompleteQuery<AutocompletePrefix>>();

    const sendTypingStatus = useTypingStatusUpdater(mx, roomId);

    const handleFiles = useCallback(
      async (files: File[]) => {
        setUploadBoard(true);
        setUploadSizeError(null);

        // Enforce space upload size limit
        const maxBytes = spaceUploadSettings?.maxFileSizeBytes ?? 0;
        let filesToProcess = files;
        if (maxBytes > 0) {
          const rejected = files.filter((f) => f.size > maxBytes);
          filesToProcess = files.filter((f) => f.size <= maxBytes);
          if (rejected.length > 0) {
            const maxMb = Math.round(maxBytes / (1024 * 1024));
            const names = rejected.map((f) => f.name).join(', ');
            setUploadSizeError(
              `${rejected.length} Datei${
                rejected.length > 1 ? 'en' : ''
              } abgelehnt (>${maxMb} MB): ${names}`
            );
          }
          if (filesToProcess.length === 0) return;
        }

        const safeFiles = filesToProcess.map(safeFile);
        const fileItems: TUploadItem[] = [];

        if (room.hasEncryptionStateEvent()) {
          const encryptFiles = fulfilledPromiseSettledResult(
            await Promise.allSettled(safeFiles.map((f) => encryptFile(f)))
          );
          encryptFiles.forEach((ef) =>
            fileItems.push({
              ...ef,
              metadata: {
                markedAsSpoiler: false,
              },
            })
          );
        } else {
          safeFiles.forEach((f) =>
            fileItems.push({
              file: f,
              originalFile: f,
              encInfo: undefined,
              metadata: {
                markedAsSpoiler: false,
              },
            })
          );
        }
        setSelectedFiles({
          type: 'PUT',
          item: fileItems,
        });
      },
      [setSelectedFiles, room, spaceUploadSettings]
    );
    const pickFile = useFilePicker(handleFiles, true);
    const handlePaste = useFilePasteHandler(handleFiles);
    const dropZoneVisible = useFileDropZone(fileDropContainerRef, handleFiles);
    const [isNarrowPicker, setIsNarrowPicker] = useState(document.body.clientWidth < 500);

    const isComposing = useComposingCheck();

    useElementSizeObserver(
      useCallback(() => document.body, []),
      useCallback((width) => setIsNarrowPicker(width < 500), [])
    );

    useEffect(() => {
      Transforms.insertFragment(editor, msgDraft);
    }, [editor, msgDraft]);

    useEffect(
      () => () => {
        if (!isEmptyEditor(editor)) {
          const parsedDraft = JSON.parse(JSON.stringify(editor.children));
          setMsgDraft(parsedDraft);
        } else {
          setMsgDraft([]);
        }
        resetEditor(editor);
        resetEditorHistory(editor);
      },
      [roomId, editor, setMsgDraft]
    );

    const handleFileMetadata = useCallback(
      (fileItem: TUploadItem, metadata: TUploadMetadata) => {
        setSelectedFiles({
          type: 'REPLACE',
          item: fileItem,
          replacement: { ...fileItem, metadata },
        });
      },
      [setSelectedFiles]
    );

    const handleRemoveUpload = useCallback(
      (upload: TUploadContent | TUploadContent[]) => {
        const uploads = Array.isArray(upload) ? upload : [upload];
        setSelectedFiles({
          type: 'DELETE',
          item: selectedFiles.filter((f) => uploads.find((u) => u === f.file)),
        });
        uploads.forEach((u) => roomUploadAtomFamily.remove(u));
      },
      [setSelectedFiles, selectedFiles]
    );

    const handleCancelUpload = (uploads: Upload[]) => {
      uploads.forEach((upload) => {
        if (upload.status === UploadStatus.Loading) {
          mx.cancelUpload(upload.promise);
        }
      });
      handleRemoveUpload(uploads.map((upload) => upload.file));
    };

    const handleSendUpload = async (uploads: UploadSuccess[]) => {
      const contentsPromises = uploads.map(async (upload) => {
        const fileItem = selectedFiles.find((f) => f.file === upload.file);
        if (!fileItem) throw new Error('Broken upload');

        if (fileItem.file.type.startsWith('image')) {
          return getImageMsgContent(mx, fileItem, upload.mxc);
        }
        if (fileItem.file.type.startsWith('video')) {
          return getVideoMsgContent(mx, fileItem, upload.mxc);
        }
        if (fileItem.file.type.startsWith('audio')) {
          return getAudioMsgContent(fileItem, upload.mxc);
        }
        return getFileMsgContent(fileItem, upload.mxc);
      });
      handleCancelUpload(uploads);
      const contents = fulfilledPromiseSettledResult(await Promise.allSettled(contentsPromises));
      contents.forEach((content) => mx.sendMessage(roomId, content as any));
    };

    const submit = useCallback(() => {
      uploadBoardHandlers.current?.handleSend();

      const commandName = getBeginCommand(editor);
      let plainText = toPlainText(editor.children, isMarkdown).trim();
      let customHtml = trimCustomHtml(
        toMatrixCustomHTML(editor.children, {
          allowTextFormatting: true,
          allowBlockMarkdown: isMarkdown,
          allowInlineMarkdown: isMarkdown,
          hashRouter,
        })
      );
      let msgType = MsgType.Text;

      if (commandName) {
        plainText = trimCommand(commandName, plainText);
        customHtml = trimCommand(commandName, customHtml);
      }
      if (commandName === Command.Me) {
        msgType = MsgType.Emote;
      } else if (commandName === Command.Notice) {
        msgType = MsgType.Notice;
      } else if (commandName === Command.Shrug) {
        plainText = `${SHRUG} ${plainText}`;
        customHtml = `${SHRUG} ${customHtml}`;
      } else if (commandName === Command.TableFlip) {
        plainText = `${TABLEFLIP} ${plainText}`;
        customHtml = `${TABLEFLIP} ${customHtml}`;
      } else if (commandName === Command.UnFlip) {
        plainText = `${UNFLIP} ${plainText}`;
        customHtml = `${UNFLIP} ${customHtml}`;
      } else if (commandName) {
        const commandContent = commands[commandName as Command];
        if (commandContent) {
          commandContent.exe(plainText);
        }
        resetEditor(editor);
        resetEditorHistory(editor);
        sendTypingStatus(false);
        return;
      }

      if (plainText === '') return;

      const body = plainText;
      const formattedBody = customHtml;
      const mentionData = getMentions(mx, roomId, editor);

      const content: IContent = {
        msgtype: msgType,
        body,
      };

      const currentUserId = mx.getUserId();
      if (replyDraft && currentUserId && replyDraft.userId !== currentUserId) {
        mentionData.users.add(replyDraft.userId);
      }

      const mMentions = getMentionContent(Array.from(mentionData.users), mentionData.room);
      content['m.mentions'] = mMentions;

      if (replyDraft || !customHtmlEqualsPlainText(formattedBody, body)) {
        content.format = 'org.matrix.custom.html';
        content.formatted_body = formattedBody;
      }
      if (threadId) {
        // Sending a thread reply (thread-native, no fallback to main timeline)
        content['m.relates_to'] = {
          rel_type: RelationType.Thread,
          event_id: threadId,
          ...(replyDraft
            ? {
                'm.in_reply_to': { event_id: replyDraft.eventId },
                is_falling_back: false,
              }
            : {}),
        };
      } else if (replyDraft) {
        content['m.relates_to'] = {
          'm.in_reply_to': {
            event_id: replyDraft.eventId,
          },
        };
        if (replyDraft.relation?.rel_type === RelationType.Thread) {
          content['m.relates_to'].event_id = replyDraft.relation.event_id;
          content['m.relates_to'].rel_type = RelationType.Thread;
          content['m.relates_to'].is_falling_back = false;
        }
      }
      mx.sendMessage(roomId, content as any);
      resetEditor(editor);
      resetEditorHistory(editor);
      setReplyDraft(undefined);
      sendTypingStatus(false);
    }, [
      mx,
      roomId,
      threadId,
      editor,
      replyDraft,
      sendTypingStatus,
      setReplyDraft,
      isMarkdown,
      commands,
      hashRouter,
    ]);

    const handleKeyDown: KeyboardEventHandler = useCallback(
      (evt) => {
        if (
          (isKeyHotkey('mod+enter', evt) || (!enterForNewline && isKeyHotkey('enter', evt))) &&
          !isComposing(evt)
        ) {
          evt.preventDefault();
          submit();
        }
        if (isKeyHotkey('escape', evt)) {
          evt.preventDefault();
          // 1. Autocomplete
          if (autocompleteQuery) {
            setAutocompleteQuery(undefined);
            return;
          }
          // 2. Edit abbrechen
          if (editId !== undefined && setEditId) {
            setEditId(undefined);
            return;
          }
          // 3. Reply abbrechen
          if (replyDraft) {
            setReplyDraft(undefined);
            return;
          }
          // 4. Als gelesen markieren
          const escRoom = mx.getRoom(roomId);
          if (escRoom) {
            const lastEvent = escRoom.getLiveTimeline().getEvents().at(-1);
            if (lastEvent) {
              mx.sendReadReceipt(lastEvent).catch(() => {});
            }
          }
        }
      },
      [
        submit,
        setReplyDraft,
        enterForNewline,
        autocompleteQuery,
        isComposing,
        editId,
        setEditId,
        mx,
        roomId,
      ]
    );

    const handleKeyUp: KeyboardEventHandler = useCallback(
      (evt) => {
        if (isKeyHotkey('escape', evt)) {
          evt.preventDefault();
          return;
        }

        if (!hideActivity) {
          sendTypingStatus(!isEmptyEditor(editor));
        }

        const prevWordRange = getPrevWorldRange(editor);
        const query = prevWordRange
          ? getAutocompleteQuery<AutocompletePrefix>(editor, prevWordRange, AUTOCOMPLETE_PREFIXES)
          : undefined;
        setAutocompleteQuery(query);
      },
      [editor, sendTypingStatus, hideActivity]
    );

    const handleCloseAutocomplete = useCallback(() => {
      setAutocompleteQuery(undefined);
      ReactEditor.focus(editor);
    }, [editor]);

    const handleEmoticonSelect = (key: string, shortcode: string) => {
      editor.insertNode(createEmoticonElement(key, shortcode));
      moveCursor(editor);
    };

    const handleStickerSelect = async (mxc: string, shortcode: string, label: string) => {
      const stickerUrl = mxcUrlToHttp(mx, mxc, useAuthentication);
      if (!stickerUrl) return;

      const info = await getImageInfo(
        await loadImageElement(stickerUrl),
        await getImageUrlBlob(stickerUrl)
      );

      mx.sendEvent(roomId, EventType.Sticker, {
        body: label,
        url: mxc,
        info,
      });
    };

    const handleGifSelect = useCallback(
      (gif: GifItem) => {
        mx.sendMessage(roomId, {
          msgtype: 'm.image',
          url: gif.url,
          body: gif.title || 'GIF',
          info: {
            w: gif.width,
            h: gif.height,
            mimetype: 'image/gif',
          },
        } as any);
      },
      [mx, roomId]
    );

    return (
      <div ref={ref}>
        {uploadSizeError && (
          <Box
            alignItems="Center"
            gap="200"
            style={{
              padding: `${config.space.S100} ${config.space.S300}`,
              background: 'var(--bg-caution, rgba(242, 63, 66, 0.12))',
              borderBottom: '1px solid var(--status-danger, #f23f42)',
            }}
          >
            <Icon size="100" src={Icons.Warning} />
            <Text size="T200" style={{ color: 'var(--status-danger, #f23f42)', flexGrow: 1 }}>
              {uploadSizeError}
            </Text>
            <IconButton
              variant="SurfaceVariant"
              onClick={() => setUploadSizeError(null)}
              aria-label="Schließen"
            >
              <Icon size="100" src={Icons.Cross} />
            </IconButton>
          </Box>
        )}
        {selectedFiles.length > 0 && (
          <UploadBoard
            header={
              <UploadBoardHeader
                open={uploadBoard}
                onToggle={() => setUploadBoard(!uploadBoard)}
                uploadFamilyObserverAtom={uploadFamilyObserverAtom}
                onSend={handleSendUpload}
                imperativeHandlerRef={uploadBoardHandlers}
                onCancel={handleCancelUpload}
              />
            }
          >
            {uploadBoard && (
              <Scroll size="300" hideTrack visibility="Hover">
                <UploadBoardContent>
                  {Array.from(selectedFiles)
                    .reverse()
                    .map((fileItem, index) => (
                      <UploadCardRenderer
                        // eslint-disable-next-line react/no-array-index-key
                        key={index}
                        isEncrypted={!!fileItem.encInfo}
                        fileItem={fileItem}
                        setMetadata={handleFileMetadata}
                        onRemove={handleRemoveUpload}
                      />
                    ))}
                </UploadBoardContent>
              </Scroll>
            )}
          </UploadBoard>
        )}
        <Overlay
          open={dropZoneVisible}
          backdrop={<OverlayBackdrop />}
          style={{ pointerEvents: 'none' }}
        >
          <OverlayCenter>
            <Dialog variant="Primary">
              <Box
                direction="Column"
                justifyContent="Center"
                alignItems="Center"
                gap="500"
                style={{ padding: toRem(60) }}
              >
                <Icon size="600" src={Icons.File} />
                <Text size="H4" as="h2" align="Center">
                  {`Drop Files in "${room?.name || 'Room'}"`}
                </Text>
                <Text align="Center">Drag and drop files here or click for selection dialog</Text>
              </Box>
            </Dialog>
          </OverlayCenter>
        </Overlay>
        {autocompleteQuery?.prefix === AutocompletePrefix.RoomMention && (
          <RoomMentionAutocomplete
            roomId={roomId}
            editor={editor}
            query={autocompleteQuery}
            requestClose={handleCloseAutocomplete}
          />
        )}
        {autocompleteQuery?.prefix === AutocompletePrefix.UserMention && (
          <UserMentionAutocomplete
            room={room}
            editor={editor}
            query={autocompleteQuery}
            requestClose={handleCloseAutocomplete}
          />
        )}
        {autocompleteQuery?.prefix === AutocompletePrefix.Emoticon && (
          <EmoticonAutocomplete
            imagePackRooms={imagePackRooms}
            editor={editor}
            query={autocompleteQuery}
            requestClose={handleCloseAutocomplete}
          />
        )}
        {autocompleteQuery?.prefix === AutocompletePrefix.Command && (
          <CommandAutocomplete
            room={room}
            editor={editor}
            query={autocompleteQuery}
            requestClose={handleCloseAutocomplete}
          />
        )}
        <CustomEditor
          editableName="RoomInput"
          editor={editor}
          placeholder="Send a message..."
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onPaste={handlePaste}
          top={
            replyDraft && (
              <div>
                <Box
                  alignItems="Center"
                  gap="300"
                  style={{ padding: `${config.space.S200} ${config.space.S300} 0` }}
                >
                  <IconButton
                    onClick={() => setReplyDraft(undefined)}
                    aria-label="Cancel reply"
                    variant="SurfaceVariant"
                    size="300"
                    radii="300"
                  >
                    <Icon src={Icons.Cross} size="50" />
                  </IconButton>
                  <Box direction="Row" gap="200" alignItems="Center">
                    {replyDraft.relation?.rel_type === RelationType.Thread && <ThreadIndicator />}
                    <ReplyLayout
                      userColor={replyUsernameColor}
                      username={
                        <Text size="T300" truncate>
                          <b>
                            {getMemberDisplayName(room, replyDraft.userId) ??
                              getMxIdLocalPart(replyDraft.userId) ??
                              replyDraft.userId}
                          </b>
                        </Text>
                      }
                    >
                      <Text size="T300" truncate>
                        {trimReplyFromBody(replyDraft.body)}
                      </Text>
                    </ReplyLayout>
                  </Box>
                </Box>
              </div>
            )
          }
          before={
            <IconButton
              onClick={() => pickFile('*')}
              aria-label="Attach file"
              tabIndex={-1}
              variant="SurfaceVariant"
              size="300"
              radii="300"
            >
              <Icon src={Icons.PlusCircle} />
            </IconButton>
          }
          after={
            <>
              <IconButton
                aria-label={toolbar ? 'Hide formatting toolbar' : 'Show formatting toolbar'}
                aria-pressed={toolbar}
                variant="SurfaceVariant"
                size="300"
                radii="300"
                onClick={() => setToolbar(!toolbar)}
              >
                <Icon src={toolbar ? Icons.AlphabetUnderline : Icons.Alphabet} />
              </IconButton>
              <UseStateProvider initial={undefined}>
                {(emojiBoardTab: EmojiBoardTab | undefined, setEmojiBoardTab) => (
                  <PopOut
                    offset={16}
                    alignOffset={-44}
                    position="Top"
                    align="End"
                    anchor={
                      emojiBoardTab === undefined
                        ? undefined
                        : pickerBtnRef.current?.getBoundingClientRect() ?? undefined
                    }
                    content={
                      <EmojiBoard
                        tab={emojiBoardTab}
                        onTabChange={setEmojiBoardTab}
                        imagePackRooms={imagePackRooms}
                        returnFocusOnDeactivate={false}
                        onEmojiSelect={handleEmoticonSelect}
                        onCustomEmojiSelect={handleEmoticonSelect}
                        onStickerSelect={handleStickerSelect}
                        onGifSelect={handleGifSelect}
                        roomId={roomId}
                        requestClose={() => {
                          setEmojiBoardTab((t) => {
                            if (t) {
                              if (!mobileOrTablet()) ReactEditor.focus(editor);
                              return undefined;
                            }
                            return t;
                          });
                        }}
                      />
                    }
                  >
                    {!isNarrowPicker && (
                      <>
                        <IconButton
                          aria-label="Open GIF picker"
                          aria-pressed={emojiBoardTab === EmojiBoardTab.GIF}
                          onClick={() => setEmojiBoardTab(EmojiBoardTab.GIF)}
                          variant="SurfaceVariant"
                          size="300"
                          radii="300"
                        >
                          <Icon src={Icons.Photo} filled={emojiBoardTab === EmojiBoardTab.GIF} />
                        </IconButton>
                        <IconButton
                          aria-label="Open sticker picker"
                          aria-pressed={emojiBoardTab === EmojiBoardTab.Sticker}
                          onClick={() => setEmojiBoardTab(EmojiBoardTab.Sticker)}
                          variant="SurfaceVariant"
                          size="300"
                          radii="300"
                        >
                          <Icon
                            src={Icons.Sticker}
                            filled={emojiBoardTab === EmojiBoardTab.Sticker}
                          />
                        </IconButton>
                      </>
                    )}
                    {isNarrowPicker ? (
                      <button
                        type="button"
                        ref={pickerBtnRef}
                        aria-label="Open GIF picker"
                        aria-pressed={!!emojiBoardTab}
                        onClick={() => setEmojiBoardTab(EmojiBoardTab.GIF)}
                        style={{
                          cursor: 'pointer',
                          minWidth: toRem(42),
                          minHeight: toRem(32),
                          padding: `0 ${config.space.S200}`,
                          border: 'none',
                          borderRadius: toRem(8),
                          background: emojiBoardTab
                            ? 'var(--background-secondary)'
                            : 'var(--background-tertiary)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <Text as="span" size="L400">
                          GIF
                        </Text>
                      </button>
                    ) : (
                      <IconButton
                        ref={pickerBtnRef}
                        aria-label="Open emoji picker"
                        aria-pressed={emojiBoardTab === EmojiBoardTab.Emoji}
                        onClick={() => setEmojiBoardTab(EmojiBoardTab.Emoji)}
                        variant="SurfaceVariant"
                        size="300"
                        radii="300"
                      >
                        <Icon src={Icons.Smile} filled={emojiBoardTab === EmojiBoardTab.Emoji} />
                      </IconButton>
                    )}
                  </PopOut>
                )}
              </UseStateProvider>
              <IconButton
                onClick={submit}
                aria-label="Send message"
                variant="SurfaceVariant"
                size="300"
                radii="300"
              >
                <Icon src={Icons.Send} />
              </IconButton>
            </>
          }
          bottom={
            toolbar && (
              <div>
                <Line variant="SurfaceVariant" size="300" />
                <Toolbar />
              </div>
            )
          }
        />
        <CharacterCounter count={toPlainText(editor.children, isMarkdown).length} />
      </div>
    );
  }
);
