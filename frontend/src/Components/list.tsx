
import { Schedule } from "../services/details"
import { meetingPlatforms } from '../services/details'
import { useState } from "react"
import Cards from "@cloudscape-design/components/cards"
import Box from "@cloudscape-design/components/box"
import Header from "@cloudscape-design/components/header"
import Button from "@cloudscape-design/components/button"

interface Props {
    schedules: Schedule[],
    deleteInvites: (selectedItems: Schedule[]) => void
}

export default ({ schedules, deleteInvites }: Props) => {
    const [selectedItems, setSelectedItems] = useState<Schedule[]>()

    return (
        <Cards
            onSelectionChange={({ detail }) => setSelectedItems((detail?.selectedItems ?? []) as any)}
            selectedItems={selectedItems as unknown as Schedule[]}
            cardDefinition={{
                header: schedule => schedule.Description.split("_")[1],
                sections: [
                    {
                        id: "meeting_platform",
                        header: "Meeting Platform",
                        content: schedule => meetingPlatforms.find(
                            (platform) => platform.value === schedule.Description.split("_")[0]
                        )?.label
                    },
                    {
                        id: "meeting_id",
                        header: "Meeting ID",
                        content: schedule => schedule.Name.split("_")[1]
                    },
                    {
                        id: "meeting_time",
                        header: "Meeting Time",
                        content: schedule => {
                            var options = {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZoneName: "short",
                            }
                            if (schedule && schedule.ScheduleExpression) {
                                var scheduleExpression = schedule.ScheduleExpression.match(/\(([^)]+)\)/)
                                if (scheduleExpression) {
                                    var meetingDateTime = new Date(scheduleExpression[1] + "Z")
                                    meetingDateTime.setMinutes(meetingDateTime.getMinutes() + 2)
                                    return meetingDateTime.toLocaleString(undefined, options as Intl.DateTimeFormatOptions)
                                }
                            }
                        }
                    }
                ]
            }}
            cardsPerRow={[
                { cards: 1 },
                { minWidth: 500, cards: 2 }
            ]}
            items={schedules}
            loadingText="Loading invitations"
            selectionType="multi"
            trackBy="Name"
            visibleSections={["meeting_platform", "meeting_id", "meeting_time"]}
            empty={
                <Box
                    margin={{ vertical: "xs" }}
                    textAlign="center"
                    color="inherit"
                >
                    No upcoming meetings
                </Box>
            }
            header={
                <Header
                    counter={"[" + schedules.length.toString() + "]"}
                    actions={
                        <Button
                            onClick={() => {
                                if (selectedItems) {
                                    deleteInvites([...selectedItems])
                                    selectedItems.splice(0, selectedItems.length)
                                }
                            }}
                            disabled={!selectedItems || selectedItems.length === 0}
                        >
                            Delete
                        </Button>
                    }
                >
                    Upcoming Meetings
                </Header>
            }
        />
    )
}
