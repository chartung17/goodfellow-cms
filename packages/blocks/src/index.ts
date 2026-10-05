import type { Config } from "@puckeditor/core";
import { Button, Heading, Image, Text } from "./content.js";
import { Flex, Grid, Section, Space } from "./layout.js";
import { Menu, SiteBrand } from "./navigation.js";

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

/**
 * Every built-in block, keyed by the name stored in content files. Never rename
 * a key: existing pages refer to blocks by these names.
 */
export const blocks = { Section, Grid, Flex, Space, Heading, Text, Button, Image, Menu, SiteBrand };

/** Groups for the editor's block list. */
export const categories = {
  layout: { title: "Layout", components: ["Section", "Grid", "Flex", "Space"] },
  content: { title: "Content", components: ["Heading", "Text", "Button", "Image"] },
  navigation: { title: "Navigation", components: ["Menu", "SiteBrand"] },
} satisfies Config["categories"];
