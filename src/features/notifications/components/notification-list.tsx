import { NotificationCard } from "./notification-card";
import { NotificationEmpty } from "./notification-empty";
import { NotificationBackend } from "@/api/notifications.api";

interface NotificationListProps {
  notifications: NotificationBackend[];
  isDropdown?: boolean;
  onItemClick?: () => void;
}

export function NotificationList({ notifications, isDropdown, onItemClick }: NotificationListProps) {
  if (notifications.length === 0) {
    return <NotificationEmpty isDropdown={isDropdown} />;
  }

  return (
    <div className={isDropdown ? "space-y-1 p-2" : "space-y-2"}>
      {notifications.map((notification) => (
        <NotificationCard
          key={notification.id}
          notification={notification}
          isDropdown={isDropdown}
          onClick={onItemClick}
        />
      ))}
    </div>
  );
}
