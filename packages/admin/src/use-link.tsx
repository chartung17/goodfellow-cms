import { Link } from "./router.js";
import { useStrings } from "./strings.js";

/** `Link`, with the standard "leave without publishing?" confirmation. */
export function AppLink(props: Omit<React.ComponentProps<typeof Link>, "confirmLeave">) {
  const t = useStrings();
  return <Link {...props} confirmLeave={() => window.confirm(t("unsaved.confirm"))} />;
}
