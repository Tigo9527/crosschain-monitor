import React, { useState, useEffect } from 'react';
import { Spin, Card, Row, Col, Statistic } from 'antd';
import {TokenPairsTable} from "./swapTable";
import {defiApiUrl} from "../common/Util";

export const SwapMain: React.FC = () => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ totalLiquidity: 0, totalPairs: 0 });

    useEffect(() => {
        const fetchData = async () => {
            let url = `http://127.0.0.1:9001/swap/list`;
            url = `${defiApiUrl}/defi/api/swap/list`;
            try {
                const {data} = await fetch(url).then(res => res.json());
                setData(data.list);

                // Calculate statistics
                const totalLiquidity = data.list.reduce((sum, pair) => sum + pair.PairLiquidity, 0);
                setStats({
                    totalLiquidity,
                    totalPairs: data.list.length
                });

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
        <div style={{ padding: 'px' }}>
            <h1>Token Pairs Dashboard</h1>

            {/* Statistics Row */}
            <Row gutter={16} style={{ marginBottom: '24px' }}>
                <Col span={8}>
                    <Card>
                        <Statistic
                            title="Total Pairs"
                            value={stats.totalPairs}
                            valueStyle={{ color: '#1890ff' }}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card>
                        <Statistic
                            title="Total Liquidity"
                            value={formatNumber(stats.totalLiquidity)}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card>
                        <Statistic
                            title="Watching Pairs"
                            value={data.filter(pair => !pair.Skip && !pair.Ignore).length}
                            valueStyle={{ color: '#faad14' }}
                        />
                    </Card>
                </Col>
            </Row>

            <TokenPairsTable data={data} loading={loading} />
        </div>
    );
};

// Helper function for statistics
const formatNumber = (value: number): string => {
    if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
        return `$${(value / 1000).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
};
