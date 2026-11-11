import { redirect } from "next/navigation";

/** Email Templates moved into Mailbox (buttons that open popups); old links land there */
export default function EmailTemplatesPage() {
  redirect("/admin/mailbox?open=templates");
}
