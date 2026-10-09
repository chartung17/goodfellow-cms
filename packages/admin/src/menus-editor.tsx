import type { MenuItem, Menus } from "@goodfellow-cms/core";
import { useState } from "react";
import { useStrings } from "./strings.js";
import { Button, TextField } from "./ui.js";

const MENU_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function move<T>(list: T[], index: number, by: -1 | 1): T[] {
  const target = index + by;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target] as T, next[index] as T];
  return next;
}

interface LinkRowProps {
  link: { label: string; href: string };
  index: number;
  count: number;
  onChange: (link: { label: string; href: string }) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}

function LinkRow({ link, index, count, onChange, onMove, onRemove }: LinkRowProps) {
  const t = useStrings();
  return (
    <div className="gfa-link-row">
      <TextField label={t("menus.label")} value={link.label} onChange={(label) => onChange({ ...link, label })} />
      <TextField label={t("menus.href")} value={link.href} onChange={(href) => onChange({ ...link, href })} />
      <div className="gfa-link-row-actions">
        <Button
          variant="ghost"
          aria-label={t("menus.moveUp")}
          title={t("menus.moveUp")}
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          ↑
        </Button>
        <Button
          variant="ghost"
          aria-label={t("menus.moveDown")}
          title={t("menus.moveDown")}
          disabled={index === count - 1}
          onClick={() => onMove(1)}
        >
          ↓
        </Button>
        <Button variant="ghost" onClick={onRemove}>
          {t("menus.remove")}
        </Button>
      </div>
    </div>
  );
}

/** Edits every menu: named lists of links, each link with optional links below it. */
export function MenusEditor({ menus, onChange }: { menus: Menus; onChange: (menus: Menus) => void }) {
  const t = useStrings();
  const names = Object.keys(menus).sort();
  const [selected, setSelected] = useState(names[0] ?? "");
  const [newName, setNewName] = useState("");
  const current = menus[selected] ? selected : (names[0] ?? "");
  const items = menus[current] ?? [];
  const newNameValid = MENU_NAME.test(newName) && !(newName in menus);

  const setItems = (next: MenuItem[]) => onChange({ ...menus, [current]: next });
  const updateItem = (index: number, item: MenuItem) =>
    setItems(items.map((existing, i) => (i === index ? item : existing)));

  return (
    <div className="gfa-menus">
      <p className="gfa-hint">{t("menus.intro")}</p>

      {names.length > 0 ? (
        <div className="gfa-tabs" role="tablist">
          {names.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={name === current}
              className="gfa-tab"
              onClick={() => setSelected(name)}
            >
              {name}
            </button>
          ))}
        </div>
      ) : (
        <p>{t("menus.empty")}</p>
      )}

      {current && (
        <div className="gfa-menu" role="tabpanel">
          {items.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: links have no ids, and content-based keys would change (and steal focus) on every keystroke
            <div key={index} className="gfa-menu-item">
              <LinkRow
                link={item}
                index={index}
                count={items.length}
                onChange={(link) => updateItem(index, { ...item, ...link })}
                onMove={(by) => setItems(move(items, index, by))}
                onRemove={() => setItems(items.filter((_, i) => i !== index))}
              />
              <div className="gfa-menu-children">
                {(item.children ?? []).map((child, childIndex) => (
                  <LinkRow
                    // biome-ignore lint/suspicious/noArrayIndexKey: as above
                    key={childIndex}
                    link={child}
                    index={childIndex}
                    count={item.children?.length ?? 0}
                    onChange={(link) =>
                      updateItem(index, {
                        ...item,
                        children: item.children?.map((c, i) => (i === childIndex ? link : c)),
                      })
                    }
                    onMove={(by) => updateItem(index, { ...item, children: move(item.children ?? [], childIndex, by) })}
                    onRemove={() => {
                      const children = item.children?.filter((_, i) => i !== childIndex) ?? [];
                      const { children: _removed, ...rest } = item;
                      updateItem(index, children.length ? { ...item, children } : rest);
                    }}
                  />
                ))}
                <Button
                  variant="ghost"
                  onClick={() =>
                    updateItem(index, {
                      ...item,
                      children: [...(item.children ?? []), { label: t("menus.newLink"), href: "/" }],
                    })
                  }
                >
                  {t("menus.addSublink")}
                </Button>
              </div>
            </div>
          ))}
          <div className="gfa-menu-actions">
            <Button onClick={() => setItems([...items, { label: t("menus.newLink"), href: "/" }])}>
              {t("menus.addLink")}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const { [current]: _removed, ...rest } = menus;
                onChange(rest);
              }}
            >
              {t("menus.deleteMenu")}
            </Button>
          </div>
        </div>
      )}

      <div className="gfa-inline-form">
        <TextField
          label={t("menus.newName")}
          value={newName}
          onChange={setNewName}
          error={newName && !newNameValid ? t("menus.nameInvalid") : undefined}
        />
        <Button
          disabled={!newNameValid}
          onClick={() => {
            onChange({ ...menus, [newName]: [] });
            setSelected(newName);
            setNewName("");
          }}
        >
          {t("menus.add")}
        </Button>
      </div>
    </div>
  );
}
