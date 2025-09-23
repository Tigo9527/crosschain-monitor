import React, { useState, useEffect } from 'react';
import { Spin, Card, Row, Col, Statistic, Alert } from 'antd';
import { WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import {TokenHoldersTable} from "./TokenHoldersTable";
import {defiApiUrl} from "../common/Util";

export const HolderMain: React.FC = () => {
	const [data, setData] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [stats, setStats] = useState({
		total: 0,
		healthy: 0,
		warning: 0,
		critical: 0
	});

	useEffect(() => {
		const fetchData = async () => {
			try {
				let url = `${defiApiUrl}/defi/api/token-holder/list`;
				// Simulate API response
				const mockResponse = await fetch(url).then(res => res.json());

				setData(mockResponse.data.list);

				// Calculate statistics
				const total = mockResponse.data.list.length;
				let healthy = 0;
				let warning = 0;
				let critical = 0;

				mockResponse.data.list.forEach(item => {
					const balanceNum = parseFloat(item.balance);
					const minBalanceNum = parseFloat(item.minBalance);

					if (balanceNum >= minBalanceNum) {
						healthy++;
					} else if (balanceNum >= minBalanceNum * 0.5) {
						warning++;
					} else {
						critical++;
					}
				});

				setStats({ total, healthy, warning, critical });

			} catch (error) {
				console.error('Error fetching data:', error);
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, []);

	if (loading) {
		return <Spin size="large" style={{ display: 'block', margin: '50px auto' }} />;
	}

	return (
		<div style={{ padding: '24px' }}>
			<h1>Balance Monitoring</h1>

			{/* Alert for critical status */}
			{stats.critical > 0 && (
				<Alert
					message={`${stats.critical} token holder(s) have critical balance levels`}
					type="error"
					showIcon
					style={{ marginBottom: '16px' }}
				/>
			)}

			{/* Statistics Row */}
			<Row gutter={16} style={{ marginBottom: '24px' }}>
				<Col span={6}>
					<Card size="small">
						<Statistic
							title="Total Holders"
							value={stats.total}
							valueStyle={{ color: '#1890ff' }}
						/>
					</Card>
				</Col>
				<Col span={6}>
					<Card size="small">
						<Statistic
							title="Healthy"
							value={stats.healthy}
							valueStyle={{ color: '#52c41a' }}
							prefix={<CheckCircleOutlined />}
						/>
					</Card>
				</Col>
				<Col span={6}>
					<Card size="small">
						<Statistic
							title="Warning"
							value={stats.warning}
							valueStyle={{ color: '#faad14' }}
							prefix={<WarningOutlined />}
						/>
					</Card>
				</Col>
				<Col span={6}>
					<Card size="small">
						<Statistic
							title="Critical"
							value={stats.critical}
							valueStyle={{ color: '#ff4d4f' }}
							prefix={<WarningOutlined />}
						/>
					</Card>
				</Col>
			</Row>

			<TokenHoldersTable data={data} loading={loading} />
		</div>
	);
};
