
import { Schedule } from "../services/schedule"
import { useState } from "react"
import Cards from "@cloudscape-design/components/cards"
import Link from "@cloudscape-design/components/link"
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
                sections: [
                    {
                        id: "meeting_id",
                        header: "Meeting ID",
                        content: schedule => (
                            <Link external href={"https://chime.aws/" + schedule.Name.split("_")[0]}>
                                {schedule.Name.split("_")[0].replace(/(\d{4})(\d{2})(\d{4})/, '$1 $2 $3')}
                            </Link>
                        )
                    },
                    {
                        id: "meeting_name",
                        header: "Meeting Name",
                        content: schedule => schedule.Description
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
            visibleSections={["meeting_id", "meeting_name", "meeting_time"]}
            empty={
                <Box
                    margin={{ vertical: "xs" }}
                    textAlign="center"
                    color="inherit"
                >
                    No invitations
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
                    Invitations
                </Header>
            }
        />
    )
}
