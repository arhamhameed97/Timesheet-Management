import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: '2 solid #000',
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    width: '35%',
    fontWeight: 'bold',
  },
  value: {
    width: '65%',
  },
  table: {
    marginTop: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #ddd',
    paddingVertical: 6,
    fontSize: 8,
  },
  tableHeader: {
    backgroundColor: '#f0f0f0',
    fontWeight: 'bold',
    paddingVertical: 6,
  },
  tableCell: {
    paddingHorizontal: 4,
  },
  dateCell: {
    width: '12%',
  },
  timeCell: {
    width: '12%',
  },
  hoursCell: {
    width: '10%',
    textAlign: 'right',
  },
  rateCell: {
    width: '12%',
    textAlign: 'right',
  },
  earningsCell: {
    width: '12%',
    textAlign: 'right',
  },
  notesCell: {
    width: '30%',
  },
  totals: {
    marginTop: 15,
    paddingTop: 10,
    borderTop: '2 solid #000',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    fontSize: 11,
  },
  totalLabel: {
    fontWeight: 'bold',
  },
  taskLogs: {
    marginTop: 15,
  },
  taskLogItem: {
    marginBottom: 5,
    paddingLeft: 10,
    borderLeft: '2 solid #ccc',
  },
  footer: {
    marginTop: 20,
    paddingTop: 10,
    borderTop: '1 solid #ddd',
    fontSize: 8,
    color: '#666',
  },
});

interface TaskLog {
  id: string;
  description: string;
  hours: number;
  user?: { name: string };
}

interface TimesheetEntry {
  id: string;
  date: string;
  hours: number;
  regularHours: number;
  overtimeHours: number;
  hourlyRate: number | null;
  earnings: number;
  attendance: {
    checkInTime: string | null;
    checkOutTime: string | null;
    status: string;
    notes: string | null;
  } | null;
  taskLogs: TaskLog[];
}

interface TimesheetPDFDetailedProps {
  employee: {
    name: string;
    email: string;
    company?: { name: string } | null;
    designation?: { name: string } | null;
  };
  period: {
    startDate: string;
    endDate: string;
  };
  entries: TimesheetEntry[];
  totals: {
    totalHours: number;
    totalRegularHours: number;
    totalOvertimeHours: number;
    totalEarnings: number;
  };
  status: string;
  approver?: {
    name: string;
    email: string;
  } | null;
  approvedAt?: string | null;
}

export function TimesheetPDFDetailed({
  employee,
  period,
  entries,
  totals,
  status,
  approver,
  approvedAt,
}: TimesheetPDFDetailedProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Detailed Timesheet</Text>
          <Text style={styles.subtitle}>
            {formatDate(period.startDate)} - {formatDate(period.endDate)}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Employee Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Name:</Text>
            <Text style={styles.value}>{employee.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Email:</Text>
            <Text style={styles.value}>{employee.email}</Text>
          </View>
          {employee.company && (
            <View style={styles.row}>
              <Text style={styles.label}>Company:</Text>
              <Text style={styles.value}>{employee.company.name}</Text>
            </View>
          )}
          {employee.designation && (
            <View style={styles.row}>
              <Text style={styles.label}>Designation:</Text>
              <Text style={styles.value}>{employee.designation.name}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Breakdown</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, styles.dateCell]}>Date</Text>
              <Text style={[styles.tableCell, styles.timeCell]}>Check-In</Text>
              <Text style={[styles.tableCell, styles.timeCell]}>Check-Out</Text>
              <Text style={[styles.tableCell, styles.hoursCell]}>Hours</Text>
              <Text style={[styles.tableCell, styles.hoursCell]}>Regular</Text>
              <Text style={[styles.tableCell, styles.hoursCell]}>OT</Text>
              <Text style={[styles.tableCell, styles.rateCell]}>Rate</Text>
              <Text style={[styles.tableCell, styles.earningsCell]}>Earnings</Text>
            </View>
            {entries.map((entry) => (
              <View key={entry.id} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.dateCell]}>
                  {formatDate(entry.date)}
                </Text>
                <Text style={[styles.tableCell, styles.timeCell]}>
                  {entry.attendance?.checkInTime
                    ? formatTime(entry.attendance.checkInTime)
                    : '-'}
                </Text>
                <Text style={[styles.tableCell, styles.timeCell]}>
                  {entry.attendance?.checkOutTime
                    ? formatTime(entry.attendance.checkOutTime)
                    : '-'}
                </Text>
                <Text style={[styles.tableCell, styles.hoursCell]}>
                  {entry.hours.toFixed(2)}
                </Text>
                <Text style={[styles.tableCell, styles.hoursCell]}>
                  {entry.regularHours.toFixed(2)}
                </Text>
                <Text style={[styles.tableCell, styles.hoursCell]}>
                  {entry.overtimeHours.toFixed(2)}
                </Text>
                <Text style={[styles.tableCell, styles.rateCell]}>
                  {entry.hourlyRate ? formatCurrency(entry.hourlyRate) : '-'}
                </Text>
                <Text style={[styles.tableCell, styles.earningsCell]}>
                  {formatCurrency(entry.earnings)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {entries.some((e) => e.taskLogs.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Task Logs</Text>
            {entries.map((entry) =>
              entry.taskLogs.map((log) => (
                <View key={log.id} style={styles.taskLogItem}>
                  <Text>
                    <Text style={{ fontWeight: 'bold' }}>
                      {formatDate(entry.date)}:
                    </Text>{' '}
                    {log.description} ({log.hours.toFixed(2)} hrs)
                  </Text>
                </View>
              ))
            )}
          </View>
        )}

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Hours:</Text>
            <Text>{totals.totalHours.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Regular Hours:</Text>
            <Text>{totals.totalRegularHours.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Overtime Hours:</Text>
            <Text>{totals.totalOvertimeHours.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Earnings:</Text>
            <Text>{formatCurrency(totals.totalEarnings)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Status:</Text>
            <Text style={styles.value}>{status}</Text>
          </View>
          {approver && (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>Approved By:</Text>
                <Text style={styles.value}>{approver.name} ({approver.email})</Text>
              </View>
              {approvedAt && (
                <View style={styles.row}>
                  <Text style={styles.label}>Approved At:</Text>
                  <Text style={styles.value}>{formatDate(approvedAt)}</Text>
                </View>
              )}
            </>
          )}
        </View>

        <View style={styles.footer}>
          <Text>Generated on {new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</Text>
        </View>
      </Page>
    </Document>
  );
}
