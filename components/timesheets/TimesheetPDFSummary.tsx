import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 30,
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
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    width: '40%',
    fontWeight: 'bold',
  },
  value: {
    width: '60%',
  },
  table: {
    marginTop: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #ddd',
    paddingVertical: 8,
  },
  tableHeader: {
    backgroundColor: '#f0f0f0',
    fontWeight: 'bold',
    paddingVertical: 8,
  },
  tableCell: {
    flex: 1,
    paddingHorizontal: 5,
  },
  totals: {
    marginTop: 20,
    paddingTop: 10,
    borderTop: '2 solid #000',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
    fontSize: 12,
  },
  totalLabel: {
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 30,
    paddingTop: 10,
    borderTop: '1 solid #ddd',
    fontSize: 8,
    color: '#666',
  },
});

interface TimesheetPDFSummaryProps {
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
  totals: {
    totalHours: number;
    totalRegularHours: number;
    totalOvertimeHours: number;
    totalEarnings: number;
  };
  averageHourlyRate: number | null;
  status: string;
  approver?: {
    name: string;
    email: string;
  } | null;
  approvedAt?: string | null;
}

export function TimesheetPDFSummary({
  employee,
  period,
  totals,
  averageHourlyRate,
  status,
  approver,
  approvedAt,
}: TimesheetPDFSummaryProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
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
          <Text style={styles.title}>Timesheet Summary</Text>
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
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCell}>Metric</Text>
              <Text style={styles.tableCell}>Value</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Total Hours</Text>
              <Text style={styles.tableCell}>{totals.totalHours.toFixed(2)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Regular Hours</Text>
              <Text style={styles.tableCell}>{totals.totalRegularHours.toFixed(2)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Overtime Hours</Text>
              <Text style={styles.tableCell}>{totals.totalOvertimeHours.toFixed(2)}</Text>
            </View>
            {averageHourlyRate && (
              <View style={styles.tableRow}>
                <Text style={styles.tableCell}>Average Hourly Rate</Text>
                <Text style={styles.tableCell}>{formatCurrency(averageHourlyRate)}</Text>
              </View>
            )}
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Total Earnings</Text>
              <Text style={styles.tableCell}>{formatCurrency(totals.totalEarnings)}</Text>
            </View>
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
