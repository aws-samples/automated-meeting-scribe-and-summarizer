
import { useState } from "react"
import { useNavigate } from "react-router-dom";
import SideNavigation from '@cloudscape-design/components/side-navigation';

export default function Navigation() {
  const [activeHref, setActiveHref] = useState("/");
  const navigate = useNavigate();

  return (
    <SideNavigation
      activeHref={activeHref}
      header={{ href: "#/", text: "Scribe" }}
      onFollow={event => {
        if (!event.detail.external) {
          event.preventDefault();
          setActiveHref(event.detail.href);
          navigate(event.detail.href)
        }
      }}
      items={[
        { type: "link", text: "Create Invite", href: "/create" },
        { type: "link", text: "List Invites", href: "/list" },
        { type: "divider" },
        {
          type: "link",
          text: "GitHub",
          href: "https://github.com/aws-samples/automated-meeting-scribe-and-summarizer",
          external: true
        }
      ]}
    />
  );
}
