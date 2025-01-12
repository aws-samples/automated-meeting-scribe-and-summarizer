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
import { Meeting } from "../details";
import * as mutations from "../graphql/mutations";
import * as queries from "../graphql/queries";
import { meetingPlatforms } from "../platform";

const List = () => {
    const [navigationOpen, setNavigationOpen] = useState<boolean>(true);

    const client = generateClient();

    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [selectedMeetings, setSelectedMeetings] = useState<Meeting[]>();

    useEffect(() => {
        const fetchMeetings = async () => {
            try {
                const { data } = await client.graphql({
                    query: queries.listMeetings,
                });
                setMeetings(data.listMeetings?.items || []);
            } catch (error) {
                console.error("Failed to get meetings.", error);
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
                            counter={"[" + meetings.length.toString() + "]"}
                            actions={
                                <Button
                                    onClick={() => {
                                        if (selectedMeetings) {
                                            selectedMeetings.forEach(
                                                (meeting) => {
                                                    client
                                                        .graphql({
                                                            query: mutations.deleteMeeting,
                                                            variables: {
                                                                input: {
                                                                    uid: meeting.uid,
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
                                            setMeetings(
                                                meetings.filter(
                                                    (meeting) =>
                                                        !selectedMeetings.includes(
                                                            meeting
                                                        )
                                                )
                                            );
                                            setSelectedMeetings([]);
                                        }
                                    }}
                                    disabled={
                                        !selectedMeetings ||
                                        selectedMeetings.length === 0
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
                            setSelectedMeetings(detail?.selectedItems ?? [])
                        }
                        selectedItems={selectedMeetings}
                        cardDefinition={{
                            header: (meeting) => meeting.name,
                            sections: [
                                {
                                    id: "meeting_platform",
                                    header: "Meeting Platform",
                                    content: (meeting) =>
                                        meetingPlatforms.find(
                                            (platform) =>
                                                platform.value ===
                                                meeting.platform
                                        )?.label,
                                },
                                {
                                    id: "meeting_id",
                                    header: "Meeting ID",
                                    content: (meeting) => meeting.id,
                                },
                                {
                                    id: "meeting_password",
                                    header: "Meeting Password",
                                    content: (meeting) => meeting.password,
                                },
                                {
                                    id: "meeting_time",
                                    header: "Meeting Time",
                                    content: (meeting) => {
                                        const meetingDateTime = new Date(
                                            meeting.time * 1000
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
                                    content: (meeting) => meeting.status,
                                },
                                {
                                    id: "scribe_name",
                                    header: "Scribe Name",
                                    content: (meeting) => meeting.scribe,
                                },
                            ],
                        }}
                        cardsPerRow={[
                            { cards: 1 },
                            { minWidth: 500, cards: 3 },
                            { minWidth: 1000, cards: 6 },
                        ]}
                        items={meetings}
                        loadingText="Loading meetings"
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
                                No meetings
                            </Box>
                        }
                    />
                </ContentLayout>
            }
        />
    );
};

export default List;
