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
import NavigationComponent from "../components/navigation";
import { FlashbarComponent } from "../components/notifications";
import { Invite } from "../details";
import * as mutations from "../graphql/mutations";
import * as queries from "../graphql/queries";
import { meetingPlatforms } from "../platform";

const List = () => {
    const [navigationOpen, setNavigationOpen] = useState<boolean>(true);

    const client = generateClient();

    const [invites, setInvites] = useState<Invite[]>([]);
    const [selectedInvites, setSelectedInvites] = useState<Invite[]>();

    useEffect(() => {
        const fetchMeetings = async () => {
            try {
                const { data } = await client.graphql({
                    query: queries.getInvites,
                });
                setInvites(
                    data.getInvites?.filter(
                        (invite): invite is Invite => invite !== null
                    ) ?? []
                );
            } catch (error) {
                console.error("Failed to get invites.", error);
            }
        };
        fetchMeetings();
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
                                                    const {
                                                        platform,
                                                        id,
                                                        password,
                                                        time,
                                                    } = invite.meeting;
                                                    client
                                                        .graphql({
                                                            query: mutations.deleteInvite,
                                                            variables: {
                                                                input: {
                                                                    platform:
                                                                        platform,
                                                                    id: id,
                                                                    password:
                                                                        password,
                                                                    time: time,
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
                                                invite.meeting.platform
                                        )?.label,
                                },
                                {
                                    id: "meeting_id",
                                    header: "Meeting ID",
                                    content: (invite) => invite.meeting.id,
                                },
                                {
                                    id: "meeting_password",
                                    header: "Meeting Password",
                                    content: (invite) =>
                                        invite.meeting.password,
                                },
                                {
                                    id: "meeting_time",
                                    header: "Meeting Time",
                                    content: (invite) => {
                                        const meetingDateTime = new Date(
                                            invite.meeting.time * 1000
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
                                    content: (invite) => invite.status,
                                },
                                {
                                    id: "scribe_name",
                                    header: "Scribe Name",
                                    content: (invite) => invite.scribe,
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
                            "scribe_name",
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
