import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Bell, Calendar, Trash2, Mail, MailOpen, Users } from "lucide-react"
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/App-sidebar";
import Header from "@/components/layout/Header";

export default function NotificationsManagement() {
  const [notificationFilter, setNotificationFilter] = useState("all")

  const [notifications, setNotifications] = useState([
    {
      id: 1,
      subject: "Advising Period Extended",
      message:
        "The advising period has been extended until January 20, 2025. Please ensure all students complete their advising sessions.",
      sender: "System Administrator",
      date: "2025-01-10",
      isRead: true,
    },
    {
      id: 2,
      subject: "Faculty Meeting Reminder",
      message: "Reminder: Faculty meeting scheduled for January 15, 2025 at 2:00 PM in Conference Room A.",
      sender: "Academic Affairs",
      date: "2025-01-08",
      isRead: false,
    },
    {
      id: 3,
      subject: "System Maintenance Notice",
      message:
        "The advising system will undergo maintenance on January 12, 2025 from 10:00 PM to 2:00 AM. Please plan accordingly.",
      sender: "IT Department",
      date: "2025-01-05",
      isRead: true,
    },
    {
      id: 4,
      subject: "Grade Submission Deadline",
      message: "Final grades must be submitted by January 18, 2025. Late submissions will require special approval.",
      sender: "Registrar Office",
      date: "2025-01-03",
      isRead: false,
    },
  ])

  const handleDeleteNotification = (id) => {
    setNotifications(notifications.filter((n) => n.id !== id))
  }

  const filteredNotifications = notificationFilter === "all" ? notifications : notifications.filter((n) => !n.isRead)

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full">
        <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
        <div className="container mx-auto p-4 md:p-6 mt-4">
          <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-semibold text-[#1b4b2a] dark:text-emerald-300">Notifications</h1>
                <p className="text-muted-foreground mt-1">View and manage your notifications</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm">
                <Bell className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">{unreadCount} Unread</span>
              </div>
            </div>

            {/* Notifications List */}
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardHeader className="border-b border-gray-100 py-4 px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-50">
                      <Mail className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold text-gray-900">All Notifications</CardTitle>
                      <CardDescription className="text-sm text-gray-600">
                        {notifications.length} total notifications
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                    <button
                      onClick={() => setNotificationFilter("all")}
                      className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        notificationFilter === "all"
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      All ({notifications.length})
                    </button>
                    <button
                      onClick={() => setNotificationFilter("unread")}
                      className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        notificationFilter === "unread"
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      Unread ({unreadCount})
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 px-6">
                {filteredNotifications.length === 0 ? (
                  <div className="text-center py-12">
                    <MailOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">
                      No {notificationFilter === "unread" ? "unread" : ""} notifications
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 rounded-lg border transition-colors ${notification.isRead
                          ? "bg-white border-gray-200 hover:border-gray-300"
                          : "bg-blue-50 border-blue-200 hover:border-blue-300"
                          }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-start gap-3 mb-3">
                              {notification.isRead ? (
                                <MailOpen className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                              ) : (
                                <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                              )}
                              <div className="flex-1">
                                <p
                                  className={`font-semibold text-base mb-1 ${notification.isRead ? "text-gray-700" : "text-gray-900"}`}
                                >
                                  {notification.subject}
                                </p>
                                <p className={`text-sm mb-3 ${notification.isRead ? "text-gray-600" : "text-gray-700"}`}>
                                  {notification.message}
                                </p>
                                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                                  <div className="flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5" />
                                    <span>{notification.sender}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5" />
                                    <span>{new Date(notification.date).toLocaleDateString()}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteNotification(notification.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </SidebarProvider>
  )
}
