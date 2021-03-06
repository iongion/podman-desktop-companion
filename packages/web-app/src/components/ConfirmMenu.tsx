import { useCallback, useRef, useState } from "react";
import { Menu, MenuItem, Button, Position, Intent, ButtonGroup } from "@blueprintjs/core";
import { IconName, IconNames } from "@blueprintjs/icons";
import { Popover2 } from "@blueprintjs/popover2";
import { useTranslation } from "react-i18next";

export type ConfirmMenuRemoveHandler = (tag: any, confirmed: boolean) => void;

export interface ConfirmMenuItemProps {
  icon?: IconName;
  tag?: any;
  text?: string;
  intent?: Intent;
  disabled?: boolean;
  autoConfirm?: boolean;
  onConfirm?: (tag: any, e: any) => void;
  onCancel?: (tag: any, e: any) => void;
}
export const ConfirmMenuItem: React.FC<ConfirmMenuItemProps> = ({
  icon,
  tag,
  text,
  disabled,
  intent,
  onConfirm,
  onCancel
}) => {
  const { t } = useTranslation();
  const [confirm, setConfirm] = useState(false);
  const onTrigger = useCallback(
    (e) => {
      e.stopPropagation();
      e.preventDefault();
      setConfirm(!confirm);
      return false;
    },
    [confirm, setConfirm]
  );
  const onConfirmClick = useCallback(
    (e) => {
      if (onConfirm) {
        onConfirm(tag, e);
      }
    },
    [onConfirm, tag]
  );
  const onCancelClick = useCallback(
    (e) => {
      if (onCancel) {
        onCancel(tag, e);
      }
    },
    [onCancel, tag]
  );

  return confirm ? (
    <MenuItem
      text={t("Confirmed ?")}
      intent={Intent.NONE}
      onClick={onTrigger}
      className="ActionMenuItemConfirm"
      labelElement={
        <ButtonGroup>
          <Button disabled={disabled} minimal small text={t("Yes")} intent={Intent.DANGER} onClick={onConfirmClick} />
          <Button disabled={disabled} minimal small text={t("No")} intent={Intent.SUCCESS} onClick={onCancelClick} />
        </ButtonGroup>
      }
    />
  ) : (
    <MenuItem
      disabled={disabled}
      icon={icon || IconNames.TRASH}
      text={text || t("Remove")}
      intent={intent || Intent.DANGER}
      onClick={onTrigger}
    />
  );
};
export interface ConfirmMenuProps {
  disabled?: boolean;
  children: any;
  tag?: any;
  onConfirm: ConfirmMenuRemoveHandler;
}
export const ConfirmMenu: React.FC<ConfirmMenuProps> = ({ disabled, tag, children, onConfirm }) => {
  const popoverRef = useRef<any>(null);
  const onActionConfirm = useCallback(
    (e) => {
      if (popoverRef.current) {
        popoverRef.current.handleOverlayClose(e);
      }
      onConfirm(tag, true);
    },
    [onConfirm, tag]
  );
  const onActionCancel = useCallback(
    (e) => {
      if (popoverRef.current) {
        popoverRef.current.handleOverlayClose(e);
      }
      onConfirm(tag, false);
    },
    [onConfirm, tag]
  );
  const menuContent = (
    <Menu>
      {children}
      <ConfirmMenuItem tag={tag} disabled={disabled} onConfirm={onActionConfirm} onCancel={onActionCancel} />
    </Menu>
  );
  return (
    <Popover2 ref={popoverRef} usePortal hasBackdrop={false} content={menuContent} position={Position.BOTTOM_LEFT}>
      <Button minimal small icon={IconNames.MORE} />
    </Popover2>
  );
};
