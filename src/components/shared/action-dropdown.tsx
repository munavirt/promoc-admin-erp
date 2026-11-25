import { MoreVertical, Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ActionDropdownProps {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Label for the destructive action (default "Delete"), e.g. "Terminate" for soft deletes. */
  deleteLabel?: string;
  deleteIcon?: React.ReactNode;
}

export function ActionDropdown({ onView, onEdit, onDelete, deleteLabel = "Delete", deleteIcon }: ActionDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onView && (
          <DropdownMenuItem onClick={onView} className="cursor-pointer">
            <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
            View
          </DropdownMenuItem>
        )}
        {onEdit && (
          <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
            <Pencil className="mr-2 h-4 w-4 text-muted-foreground" />
            Edit
          </DropdownMenuItem>
        )}
        {(onView || onEdit) && onDelete && <DropdownMenuSeparator />}
        {onDelete && (
          <DropdownMenuItem 
            onClick={onDelete} 
            className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-600"
          >
            {deleteIcon ?? <Trash2 className="mr-2 h-4 w-4" />}
            {deleteLabel}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
