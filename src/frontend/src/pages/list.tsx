
import { useState, useEffect } from "react"

import { meetingPlatforms, Invite } from '../details'
import { apiCall } from '../api';

import {
    AppLayout,
    HelpPanel,
    ContentLayout,
    Header,
    Button,
    Cards,
    Box,
} from "@cloudscape-design/components";
import NavigationComponent from "../components/navigation";
import { FlashbarComponent } from '../components/notifications';

const List = () => {
    const [navigationOpen, setNavigationOpen] = useState<boolean>(true);

    const [meetings, setMeetings] = useState<Invite[]>([]);
    const [selectedMeetings, setSelectedMeetings] = useState<Invite[]>();

    useEffect(() => {
        const fetchMeetings = async () => {
            const body = await apiCall('get-invites', 'GET');
            setMeetings(body.invites || []);
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
                        <li>To delete an invite for an upcoming meeting, select the invite then click <strong>Delete</strong>.</li>
                    </ul>
                </HelpPanel>}
            content={
                <ContentLayout
                    header={
                        <Header
                            counter={"[" + meetings.length.toString() + "]"}
                            actions={
                                <Button
                                    onClick={() => {
                                        if (selectedMeetings) {
                                            apiCall('delete-invites', 'DELETE', [...selectedMeetings])
                                            setMeetings(meetings.filter(meeting => !selectedMeetings.includes(meeting)))
                                            setSelectedMeetings([])
                                        }
                                    }}
                                    disabled={!selectedMeetings || selectedMeetings.length === 0}
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
                            header: meeting => meeting.name,
                            sections: [
                                {
                                    id: "meeting_platform",
                                    header: "Meeting Platform",
                                    content: meeting => meetingPlatforms.find(
                                        (platform) => platform.value === meeting.platform
                                    )?.label
                                },
                                {
                                    id: "meeting_id",
                                    header: "Meeting ID",
                                    content: meeting => meeting.id
                                },
                                {
                                    id: "meeting_password",
                                    header: "Meeting Password",
                                    content: meeting => meeting.password
                                },
                                {
                                    id: "meeting_time",
                                    header: "Meeting Time",
                                    content: meeting => {
                                        const meetingDateTime = new Date(meeting.time * 1000);
                                        const options: Intl.DateTimeFormatOptions = {
                                            year: "numeric",
                                            month: "long",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            timeZoneName: "short"
                                        };
                                        return meetingDateTime.toLocaleString("en-US", options)
                                    }
                                },
                                {
                                    id: "scribe_name",
                                    header: "Scribe Name",
                                    content: meeting => meeting.scribe
                                },
                            ]
                        }}
                        cardsPerRow={[
                            { cards: 1 },
                            { minWidth: 500, cards: 3 },
                            { minWidth: 1000, cards: 6 }
                        ]}
                        items={meetings}
                        loadingText="Loading invites"
                        selectionType="multi"
                        visibleSections={["meeting_platform", "meeting_id", "meeting_time", "scribe_name"]}
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
    )
}

export default List;
