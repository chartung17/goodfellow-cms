import type { Config } from "@puckeditor/core";
import { Code } from "./code.js";
import { CollectionList, EntryField } from "./collections.js";
import { ContactDetails } from "./contact.js";
import { Button, Heading, Image, Text } from "./content.js";
import { CollectionNav, EntryPager, OnThisPage } from "./docs.js";
import { Flex, Grid, Section, Space } from "./layout.js";
import { Menu, SiteBrand } from "./navigation.js";
import { Search } from "./search.js";

export { Code, type CodeProps, CodeView } from "./code.js";
export {
  CollectionList,
  type CollectionListProps,
  EntryField,
  type EntryFieldProps,
  listedEntries,
} from "./collections.js";
export { ContactDetails, type ContactDetailsProps } from "./contact.js";
export {
  Button,
  type ButtonProps,
  Heading,
  type HeadingProps,
  Image,
  type ImageProps,
  Text,
  type TextProps,
} from "./content.js";
export {
  CollectionNav,
  type CollectionNavProps,
  EntryPager,
  type EntryPagerProps,
  OnThisPage,
  type OnThisPageProps,
} from "./docs.js";
export {
  CODE_LANGUAGES,
  type CodeColors,
  type CodeLanguage,
  codeLanguage,
  highlightCode,
  loadHighlighter,
} from "./highlight.js";
export {
  Flex,
  type FlexProps,
  Grid,
  type GridProps,
  Section,
  type SectionProps,
  Space,
  type SpaceProps,
} from "./layout.js";
export { Menu, type MenuProps, SiteBrand, type SiteBrandProps } from "./navigation.js";
export { Search, type SearchProps } from "./search.js";

/**
 * Every built-in block, keyed by the name stored in content files. Never rename
 * a key: existing pages refer to blocks by these names.
 */
export const blocks = {
  Section,
  Grid,
  Flex,
  Space,
  Heading,
  Text,
  Button,
  Image,
  Code,
  ContactDetails,
  Menu,
  SiteBrand,
  Search,
  CollectionNav,
  CollectionList,
  EntryField,
  EntryPager,
  OnThisPage,
};

/** Groups for the editor's block list. */
export const categories = {
  layout: { title: "Layout", components: ["Section", "Grid", "Flex", "Space"] },
  content: { title: "Content", components: ["Heading", "Text", "Button", "Image", "Code", "ContactDetails"] },
  navigation: { title: "Navigation", components: ["Menu", "SiteBrand", "Search", "CollectionNav"] },
  collections: { title: "Collections", components: ["CollectionList", "EntryField", "EntryPager", "OnThisPage"] },
} satisfies Config["categories"];
