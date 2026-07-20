import React from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Button } from "@/components/ui/button"
import type { VMSAsset } from "@/types"
import { ArrowLeftRight, Download, EllipsisVertical, Eye, FolderInput, Link, Pencil, Trash2, Unlink, Upload } from "lucide-react"

export interface AssetMenuActions {
  onOpen?: (asset: VMSAsset) => void
  onDownload?: (asset: VMSAsset) => void
  onCopyShareLink?: (asset: VMSAsset) => void
  onToggleSharing?: (asset: VMSAsset) => void
  onConvert?: (asset: VMSAsset) => void
  onUploadNewVersion?: (asset: VMSAsset) => void
  onRename?: (asset: VMSAsset) => void
  onMoveToFolder?: (asset: VMSAsset) => void
  onDelete?: (asset: VMSAsset) => void
}

interface MenuItemsProps {
  asset: VMSAsset
  actions: AssetMenuActions
  isConvertible?: boolean
  Separator: React.ComponentType
  Item: React.ComponentType<{
    children: React.ReactNode
    variant?: "default" | "destructive"
    onClick?: () => void
  }>
}

function MenuItems({ asset, actions, isConvertible, Separator, Item }: MenuItemsProps) {
  const isReady = asset.status === "Ready"
  const isShared = asset.is_public_review === 1

  const hasTopActions = actions.onOpen || actions.onDownload
  const hasMiddleActions =
    (actions.onCopyShareLink && isShared) ||
    actions.onToggleSharing ||
    (actions.onConvert && isConvertible) ||
    actions.onUploadNewVersion
  const hasEditActions = actions.onRename || actions.onMoveToFolder
  const hasDeleteAction = !!actions.onDelete

  return (
    <>
      {actions.onOpen && isReady && (
        <Item onClick={() => actions.onOpen!(asset)}>
          <Eye />
          Open
        </Item>
      )}
      {actions.onDownload && isReady && (
        <Item onClick={() => actions.onDownload!(asset)}>
          <Download />
          Download
        </Item>
      )}
      {hasTopActions && (hasMiddleActions || hasEditActions || hasDeleteAction) && isReady && (
        <Separator />
      )}
      {actions.onCopyShareLink && isShared && isReady && (
        <Item onClick={() => actions.onCopyShareLink!(asset)}>
          <Link />
          Copy review link
        </Item>
      )}
      {actions.onToggleSharing && isReady && (
        <Item onClick={() => actions.onToggleSharing!(asset)}>
          {isShared ? <Unlink /> : <Link />}
          {isShared ? "Disable public link" : "Enable public link"}
        </Item>
      )}
      {isConvertible && actions.onConvert && isReady && (
        <Item onClick={() => actions.onConvert!(asset)}>
          <ArrowLeftRight />
          Convert to MP4
        </Item>
      )}
      {actions.onUploadNewVersion && isReady && (
        <Item onClick={() => actions.onUploadNewVersion!(asset)}>
          <Upload />
          Upload new version
        </Item>
      )}
      {hasMiddleActions && (hasEditActions || hasDeleteAction) && isReady && (
        <Separator />
      )}
      {actions.onRename && (
        <Item onClick={() => actions.onRename!(asset)}>
          <Pencil />
          Rename
        </Item>
      )}
      {actions.onMoveToFolder && (
        <Item onClick={() => actions.onMoveToFolder!(asset)}>
          <FolderInput />
          Move to folder
        </Item>
      )}
      {hasDeleteAction && (
        <>
          {hasEditActions && <Separator />}
          <Item variant="destructive" onClick={() => actions.onDelete!(asset)}>
            <Trash2 />
            Delete
          </Item>
        </>
      )}
    </>
  )
}

/** Three-dot dropdown menu trigger button for asset cards */
export function AssetDropdownMenu({
  asset,
  actions,
  isConvertible = false,
}: {
  asset: VMSAsset
  actions: AssetMenuActions
  isConvertible?: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" />}
        onClick={(e) => e.stopPropagation()}
      >
        <EllipsisVertical />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <MenuItems
          asset={asset}
          actions={actions}
          isConvertible={isConvertible}
          Separator={DropdownMenuSeparator}
          Item={DropdownMenuItem}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Context menu wrapper — wrap the card with this for right-click support */
export function AssetContextMenu({
  asset,
  actions,
  isConvertible = false,
  children,
}: {
  asset: VMSAsset
  actions: AssetMenuActions
  isConvertible?: boolean
  children: React.ReactNode
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger className="flex flex-col">
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <MenuItems
          asset={asset}
          actions={actions}
          isConvertible={isConvertible}
          Separator={ContextMenuSeparator}
          Item={ContextMenuItem}
        />
      </ContextMenuContent>
    </ContextMenu>
  )
}
