import {
    AppLayout,
    Box,
    Button,
    Cards,
    ContentLayout,
    Header,
    HelpPanel,
} from "@cloudscape-design/components";
import { generateClient } from "aws-amplify/api";
import { useEffect, useState } from "react";
import { Invite } from "../API";
import NavigationComponent from "../components/navigation";
import { FlashbarComponent } from "../components/notifications";
import { deleteInvite } from "../graphql/mutations";
import { listInvites } from "../graphql/queries";
import { meetingPlatforms } from "../platform";

const List = () => {
    const [navigationOpen, setNavigationOpen] = useState<boolean>(true);

    const client = generateClient();

    const [invites, setInvites] = useState<Invite[]>([]);
    const [selectedInvites, setSelectedInvites] = useState<Invite[]>();

    useEffect(() => {
        const fetchInvites = async () => {
            try {
                const { data } = await client.graphql({
                    query: listInvites,
                });
                setInvites(data.listInvites?.items || []);
            } catch (error) {
                console.error("Failed to get invites.", error);
            }
        };
        fetchInvites();
    }, []);

    return (
        <AppLayout
            navigation={<NavigationComponent />}
            navigationOpen={navigationOpen}
            onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
            notifications={<FlashbarComponent />}
            toolsHide={false}
            tools={
                <HelpPanel header={<h3>Instructions</h3>}>
                    <ul>
                        <li>
                            To delete an invite for an upcoming meeting, select
                            the invite then click <strong>Delete</strong>.
                        </li>
                    </ul>
                </HelpPanel>
            }
            content={
                <ContentLayout
                    header={
                        <Header
                            counter={"[" + invites.length.toString() + "]"}
                            actions={
                                <Button
                                    onClick={() => {
                                        if (selectedInvites) {
                                            selectedInvites.forEach(
                                                (invite) => {
                                                    client
                                                        .graphql({
                                                            query: deleteInvite,
                                                            variables: {
                                                                input: {
                                                                    id: invite.id,
                                                                },
                                                            },
                                                        })
                                                        .catch((error) => {
                                                            console.error(
                                                                "Failed to delete invite.",
                                                                error
                                                            );
                                                        });
                                                }
                                            );
                                            setInvites(
                                                invites.filter(
                                                    (invite) =>
                                                        !selectedInvites.includes(
                                                            invite
                                                        )
                                                )
                                            );
                                            setSelectedInvites([]);
                                        }
                                    }}
                                    disabled={
                                        !selectedInvites ||
                                        selectedInvites.length === 0
                                    }
                                >
                                    Delete
                                </Button>
                            }
                        >
                            Invites
                        </Header>
                    }
                >
                    <Cards
                        onSelectionChange={({ detail }) =>
                            setSelectedInvites(detail?.selectedItems ?? [])
                        }
                        selectedItems={selectedInvites}
                        cardDefinition={{
                            header: (invite) => invite.name,
                            sections: [
                                {
                                    id: "meeting_platform",
                                    header: "Meeting Platform",
                                    content: (invite) =>
                                        meetingPlatforms.find(
                                            (platform) =>
                                                platform.value ===
                                                invite.meetingPlatform
                                        )?.label,
                                },
                                {
                                    id: "meeting_id",
                                    header: "Meeting ID",
                                    content: (invite) => invite.meetingId,
                                },
                                {
                                    id: "meeting_password",
                                    header: "Meeting Password",
                                    content: (invite) => invite.meetingPassword,
                                },
                                {
                                    id: "meeting_time",
                                    header: "Meeting Time",
                                    content: (invite) => {
                                        const meetingDateTime = new Date(
                                            invite.meetingTime * 1000
                                        );
                                        const options: Intl.DateTimeFormatOptions =
                                            {
                                                year: "numeric",
                                                month: "long",
                                                day: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                                timeZoneName: "short",
                                            };
                                        return meetingDateTime.toLocaleString(
                                            "en-US",
                                            options
                                        );
                                    },
                                },
                                {
                                    id: "scribe_status",
                                    header: "Scribe Status",
                                    content: (invite) =>
                                        invite.status ?? "Scheduled",
                                },
                            ],
                        }}
                        cardsPerRow={[
                            { cards: 1 },
                            { minWidth: 500, cards: 3 },
                            { minWidth: 1000, cards: 6 },
                        ]}
                        items={invites}
                        loadingText="Loading invites"
                        selectionType="multi"
                        visibleSections={[
                            "meeting_platform",
                            "meeting_id",
                            "meeting_time",
                            "scribe_status",
                        ]}
                        empty={
                            <Box
                                margin={{ vertical: "xs" }}
                                textAlign="center"
                                color="inherit"
                            >
                                No invites
                            </Box>
                        }
                    />
                </ContentLayout>
            }
        />
    );
};

export default List;
