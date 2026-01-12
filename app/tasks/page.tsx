'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CheckSquare, Plus, Filter, Pencil, Trash2, CheckCircle } from 'lucide-react';
import { UserRole, TaskStatus, TaskPriority } from '@prisma/client';
import { format, parseISO } from 'date-fns';
import { toast } from '@/hooks/use-toast';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  designation?: {
    id: string;
    name: string;
  } | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  creator: {
    id: string;
    name: string;
    email: string;
  };
  approver: {
    id: string;
    name: string;
    email: string;
  } | null;
  approvedAt: string | null;
  assignees: {
    id: string;
    userId: string;
    completedAt: string | null;
    user: {
      id: string;
      name: string;
      email: string;
    };
  }[];
  createdAt: string;
  updatedAt: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
}

export default function TasksPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('all');
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editTaskDialogOpen, setEditTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskFormData, setTaskFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
    assigneeIds: [] as string[],
  });
  const [editTaskFormData, setEditTaskFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
    assigneeIds: [] as string[],
  });
  const [creatingTask, setCreatingTask] = useState(false);
  const [updatingTask, setUpdatingTask] = useState(false);
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchUserData();
  }, []);

  useEffect(() => {
    if (user) {
      fetchTasks();
      if (isManagerOrAdmin()) {
        fetchEmployeesList();
      }
    }
  }, [user, taskStatusFilter]);

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setCurrentUserId(data.user.id);
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      setLoadingTasks(true);
      const token = localStorage.getItem('token');
      let url = '/api/tasks/assignments';
      if (taskStatusFilter !== 'all') {
        url += `?status=${taskStatusFilter}`;
      }
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
        setFilteredTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch tasks',
        variant: 'destructive',
      });
    } finally {
      setLoadingTasks(false);
    }
  };

  const fetchEmployeesList = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/employees', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setEmployeesList(data.employees || []);
      }
    } catch (error) {
      console.error('Failed to fetch employees list:', error);
    }
  };

  const isManagerOrAdmin = () => {
    return user?.role === UserRole.SUPER_ADMIN || 
           user?.role === UserRole.COMPANY_ADMIN || 
           user?.role === UserRole.MANAGER;
  };

  const handleAssignTask = async () => {
    if (!taskFormData.title || !taskFormData.dueDate || taskFormData.assigneeIds.length === 0) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }
    try {
      setCreatingTask(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/tasks/assignments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskFormData),
      });

      if (response.ok) {
        await fetchTasks();
        setTaskDialogOpen(false);
        setTaskFormData({
          title: '',
          description: '',
          dueDate: '',
          priority: 'MEDIUM',
          assigneeIds: [],
        });
        toast({
          title: 'Success',
          description: 'Task assigned successfully',
        });
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to assign task',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to assign task:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign task',
        variant: 'destructive',
      });
    } finally {
      setCreatingTask(false);
    }
  };

  const handleUpdateTask = async () => {
    if (!editingTask || !editTaskFormData.title || !editTaskFormData.dueDate || editTaskFormData.assigneeIds.length === 0) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }
    try {
      setUpdatingTask(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tasks/assignments/${editingTask.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editTaskFormData),
      });

      if (response.ok) {
        await fetchTasks();
        setEditTaskDialogOpen(false);
        setEditingTask(null);
        setEditTaskFormData({
          title: '',
          description: '',
          dueDate: '',
          priority: 'MEDIUM',
          assigneeIds: [],
        });
        toast({
          title: 'Success',
          description: 'Task updated successfully',
        });
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to update task',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to update task:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task',
        variant: 'destructive',
      });
    } finally {
      setUpdatingTask(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tasks/assignments/${taskId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        await fetchTasks();
        toast({
          title: 'Success',
          description: 'Task deleted successfully',
        });
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to delete task',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to delete task:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete task',
        variant: 'destructive',
      });
    }
  };

  const handleApproveTask = async (taskId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tasks/assignments/${taskId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: TaskStatus.APPROVED }),
      });

      if (response.ok) {
        await fetchTasks();
        toast({
          title: 'Success',
          description: 'Task approved successfully',
        });
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to approve task',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to approve task:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve task',
        variant: 'destructive',
      });
    }
  };

  const handleRejectTask = async (taskId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tasks/assignments/${taskId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: TaskStatus.IN_PROGRESS }),
      });

      if (response.ok) {
        await fetchTasks();
        toast({
          title: 'Success',
          description: 'Task rejected and set back to In Progress',
        });
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to reject task',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to reject task:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject task',
        variant: 'destructive',
      });
    }
  };

  const handleTaskStatusUpdate = async (taskId: string, newStatus: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tasks/assignments/${taskId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        await fetchTasks();
        toast({
          title: 'Success',
          description: 'Task status updated successfully',
        });
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to update task status',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to update task status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task status',
        variant: 'destructive',
      });
    }
  };

  const getTaskStatusBadgeClass = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.PENDING:
        return 'bg-muted text-gray-800';
      case TaskStatus.IN_PROGRESS:
        return 'bg-blue-100 text-blue-800';
      case TaskStatus.COMPLETED:
        return 'bg-yellow-100 text-yellow-800';
      case TaskStatus.APPROVED:
        return 'bg-green-100 text-green-800';
      case TaskStatus.CANCELLED:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-muted text-gray-800';
    }
  };

  const getTaskPriorityClass = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.HIGH:
        return 'text-red-600 font-semibold';
      case TaskPriority.MEDIUM:
        return 'text-yellow-600 font-semibold';
      case TaskPriority.LOW:
        return 'text-green-600 font-semibold';
      default:
        return 'text-muted-foreground';
    }
  };

  if (loading || !user) {
    return (
      <MainLayout>
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tasks</h1>
          <p className="text-muted-foreground mt-1">
            {isManagerOrAdmin() 
              ? 'Manage and track all tasks assigned to your team'
              : 'View and manage your assigned tasks'}
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-purple-600" />
                {isManagerOrAdmin() ? 'Task Management' : 'My Tasks'} ({tasks.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                {isManagerOrAdmin() && (
                  <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="bg-purple-600 hover:bg-purple-700 text-white">
                        <Plus className="mr-2 h-4 w-4" />
                        Assign Task
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Assign New Task</DialogTitle>
                        <DialogDescription>
                          Create a task and assign it to one or more employees
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="taskTitle">Title *</Label>
                          <Input
                            id="taskTitle"
                            value={taskFormData.title}
                            onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                            placeholder="Enter task title"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="taskDescription">Description</Label>
                          <Textarea
                            id="taskDescription"
                            value={taskFormData.description}
                            onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                            placeholder="Enter task description"
                            rows={3}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="taskDueDate">Due Date *</Label>
                            <Input
                              id="taskDueDate"
                              type="date"
                              value={taskFormData.dueDate}
                              onChange={(e) => setTaskFormData({ ...taskFormData, dueDate: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="taskPriority">Priority</Label>
                            <Select
                              value={taskFormData.priority}
                              onValueChange={(value) => setTaskFormData({ ...taskFormData, priority: value as 'LOW' | 'MEDIUM' | 'HIGH' })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="LOW">Low</SelectItem>
                                <SelectItem value="MEDIUM">Medium</SelectItem>
                                <SelectItem value="HIGH">High</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Assign To *</Label>
                          <div className="max-h-48 overflow-y-auto border rounded p-2 space-y-2">
                            {employeesList.map((emp) => (
                              <div key={emp.id} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`assignee-${emp.id}`}
                                  checked={taskFormData.assigneeIds.includes(emp.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setTaskFormData({
                                        ...taskFormData,
                                        assigneeIds: [...taskFormData.assigneeIds, emp.id],
                                      });
                                    } else {
                                      setTaskFormData({
                                        ...taskFormData,
                                        assigneeIds: taskFormData.assigneeIds.filter(id => id !== emp.id),
                                      });
                                    }
                                  }}
                                />
                                <label htmlFor={`assignee-${emp.id}`} className="text-sm cursor-pointer">
                                  {emp.name} ({emp.email})
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setTaskDialogOpen(false);
                            setTaskFormData({
                              title: '',
                              description: '',
                              dueDate: '',
                              priority: 'MEDIUM',
                              assigneeIds: [],
                            });
                          }}
                          disabled={creatingTask}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleAssignTask}
                          disabled={creatingTask || !taskFormData.title || !taskFormData.dueDate || taskFormData.assigneeIds.length === 0}
                        >
                          {creatingTask ? 'Assigning...' : 'Assign Task'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
                <Select value={taskStatusFilter} onValueChange={setTaskStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tasks</SelectItem>
                    <SelectItem value={TaskStatus.PENDING}>Pending</SelectItem>
                    <SelectItem value={TaskStatus.IN_PROGRESS}>In Progress</SelectItem>
                    <SelectItem value={TaskStatus.COMPLETED}>Completed</SelectItem>
                    <SelectItem value={TaskStatus.APPROVED}>Approved</SelectItem>
                    <SelectItem value={TaskStatus.CANCELLED}>Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingTasks ? (
              <div className="text-center py-8 text-muted-foreground">Loading tasks...</div>
            ) : filteredTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No tasks found</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task Title</TableHead>
                      {isManagerOrAdmin() && <TableHead>Assigned By</TableHead>}
                      <TableHead>Assignees</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTasks.map((task) => {
                      const completedCount = task.assignees.filter(a => a.completedAt).length;
                      const totalAssignees = task.assignees.length;
                      const progressPercentage = totalAssignees > 0 ? Math.round((completedCount / totalAssignees) * 100) : 0;
                      
                      return (
                        <TableRow key={task.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{task.title}</span>
                              {task.description && (
                                <span className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</span>
                              )}
                            </div>
                          </TableCell>
                          {isManagerOrAdmin() && (
                            <TableCell>
                              <div className="text-sm">{task.creator.name}</div>
                              <div className="text-xs text-muted-foreground">{format(parseISO(task.createdAt), 'MMM dd, yyyy')}</div>
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {task.assignees.slice(0, 2).map((assignee) => (
                                <div key={assignee.id} className="flex items-center gap-1 text-sm">
                                  <span>{assignee.user.name}</span>
                                  {assignee.completedAt && (
                                    <CheckCircle className="h-3 w-3 text-green-600" />
                                  )}
                                </div>
                              ))}
                              {task.assignees.length > 2 && (
                                <span className="text-xs text-muted-foreground">+{task.assignees.length - 2} more</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 text-xs rounded-full ${getTaskStatusBadgeClass(task.status)}`}>
                              {task.status.replace('_', ' ')}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={getTaskPriorityClass(task.priority)}>
                              {task.priority}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{format(parseISO(task.dueDate), 'MMM dd, yyyy')}</div>
                            {new Date(task.dueDate) < new Date() && task.status !== TaskStatus.APPROVED && (
                              <span className="text-xs text-red-600">Overdue</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-muted rounded-full h-2 min-w-[60px]">
                                <div
                                  className={`h-2 rounded-full ${
                                    progressPercentage === 100
                                      ? 'bg-green-600'
                                      : progressPercentage > 0
                                      ? 'bg-blue-600'
                                      : 'bg-muted'
                                  }`}
                                  style={{ width: `${progressPercentage}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {completedCount}/{totalAssignees}
                              </span>
                            </div>
                            {task.approvedAt && (
                              <div className="text-xs text-green-600 mt-1">
                                Approved {format(parseISO(task.approvedAt), 'MMM dd')}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              {isManagerOrAdmin() && task.status !== TaskStatus.APPROVED && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingTask(task);
                                      setEditTaskFormData({
                                        title: task.title,
                                        description: task.description || '',
                                        dueDate: format(parseISO(task.dueDate), 'yyyy-MM-dd'),
                                        priority: task.priority,
                                        assigneeIds: task.assignees.map(a => a.userId),
                                      });
                                      setEditTaskDialogOpen(true);
                                    }}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDeleteTask(task.id)}
                                  >
                                    <Trash2 className="h-3 w-3 text-red-600" />
                                  </Button>
                                </>
                              )}
                              {isManagerOrAdmin() && task.status === TaskStatus.COMPLETED && (() => {
                                const allAssigneesCompleted = task.assignees.length > 0 && task.assignees.every(a => a.completedAt !== null);
                                return (
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleRejectTask(task.id)}
                                    >
                                      Reject
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="bg-green-600 hover:bg-green-700"
                                      onClick={() => handleApproveTask(task.id)}
                                      disabled={!allAssigneesCompleted}
                                      title={!allAssigneesCompleted ? 'All assignees must complete the task before approval' : ''}
                                    >
                                      Approve
                                    </Button>
                                  </div>
                                );
                              })()}
                              {!isManagerOrAdmin() && task.status === 'PENDING' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleTaskStatusUpdate(task.id, 'IN_PROGRESS')}
                                >
                                  Start Task
                                </Button>
                              )}
                              {!isManagerOrAdmin() && task.status !== 'PENDING' && task.status !== 'APPROVED' && (() => {
                                const currentUserAssignee = task.assignees?.find((a: any) => 
                                  a.userId === currentUserId || a.user?.id === currentUserId
                                );
                                const hasCompleted = currentUserAssignee?.completedAt !== null && currentUserAssignee?.completedAt !== undefined;
                                
                                if (!hasCompleted) {
                                  return (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleTaskStatusUpdate(task.id, 'COMPLETED')}
                                    >
                                      Mark Complete
                                    </Button>
                                  );
                                } else {
                                  return (
                                    <>
                                      {task.status === 'COMPLETED' && (
                                        <span className="text-xs text-yellow-600 self-center mr-2">Awaiting Approval</span>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleTaskStatusUpdate(task.id, 'IN_PROGRESS')}
                                      >
                                        Mark Incomplete
                                      </Button>
                                    </>
                                  );
                                }
                              })()}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Task Dialog */}
        {isManagerOrAdmin() && (
          <Dialog open={editTaskDialogOpen} onOpenChange={setEditTaskDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Task</DialogTitle>
                <DialogDescription>
                  Update task details and assignees
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="editTaskTitle">Title *</Label>
                  <Input
                    id="editTaskTitle"
                    value={editTaskFormData.title}
                    onChange={(e) => setEditTaskFormData({ ...editTaskFormData, title: e.target.value })}
                    placeholder="Enter task title"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editTaskDescription">Description</Label>
                  <Textarea
                    id="editTaskDescription"
                    value={editTaskFormData.description}
                    onChange={(e) => setEditTaskFormData({ ...editTaskFormData, description: e.target.value })}
                    placeholder="Enter task description"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editTaskDueDate">Due Date *</Label>
                    <Input
                      id="editTaskDueDate"
                      type="date"
                      value={editTaskFormData.dueDate}
                      onChange={(e) => setEditTaskFormData({ ...editTaskFormData, dueDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editTaskPriority">Priority</Label>
                    <Select
                      value={editTaskFormData.priority}
                      onValueChange={(value) => setEditTaskFormData({ ...editTaskFormData, priority: value as 'LOW' | 'MEDIUM' | 'HIGH' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Assign To *</Label>
                  <div className="max-h-48 overflow-y-auto border rounded p-2 space-y-2">
                    {employeesList.map((emp) => (
                      <div key={emp.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`editAssignee-${emp.id}`}
                          checked={editTaskFormData.assigneeIds.includes(emp.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditTaskFormData({
                                ...editTaskFormData,
                                assigneeIds: [...editTaskFormData.assigneeIds, emp.id],
                              });
                            } else {
                              setEditTaskFormData({
                                ...editTaskFormData,
                                assigneeIds: editTaskFormData.assigneeIds.filter(id => id !== emp.id),
                              });
                            }
                          }}
                        />
                        <label htmlFor={`editAssignee-${emp.id}`} className="text-sm cursor-pointer">
                          {emp.name} ({emp.email})
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditTaskDialogOpen(false);
                    setEditingTask(null);
                    setEditTaskFormData({
                      title: '',
                      description: '',
                      dueDate: '',
                      priority: 'MEDIUM',
                      assigneeIds: [],
                    });
                  }}
                  disabled={updatingTask}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateTask}
                  disabled={updatingTask || !editTaskFormData.title || !editTaskFormData.dueDate || editTaskFormData.assigneeIds.length === 0}
                >
                  {updatingTask ? 'Updating...' : 'Update Task'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </MainLayout>
  );
}
