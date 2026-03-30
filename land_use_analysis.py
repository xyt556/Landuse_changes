import pandas as pd
import numpy as np
import plotly.graph_objects as go
import os

def calculate_transfer_matrix(t1_data, t2_data, categories=None):
    """
    计算土地利用转移矩阵
    :param t1_data: 第一期地类列表/数组
    :param t2_data: 第二期地类列表/数组
    :param categories: 地类名称列表（可选）
    :return: DataFrame 格式的转移矩阵
    """
    if categories is None:
        categories = sorted(list(set(t1_data) | set(t2_data)))
    
    # 使用 pd.crosstab 快速交叉统计
    matrix = pd.crosstab(
        pd.Series(t1_data, name='T1'), 
        pd.Series(t2_data, name='T2'),
        dropna=False
    )
    
    # 补全缺失的行列（确保矩阵是方阵）
    matrix = matrix.reindex(index=categories, columns=categories, fill_value=0)
    return matrix

def plot_sankey(matrix, title="土地利用转移桑基图"):
    """
    绘制桑基图
    """
    categories = matrix.index.tolist()
    n_cat = len(categories)
    
    # 构建节点
    # 左侧节点索引 0 ~ n-1, 右侧节点索引 n ~ 2n-1
    nodes_label = [f"{c} (T1)" for c in categories] + [f"{c} (T2)" for c in categories]
    
    # 构建链接
    sources = []
    targets = []
    values = []
    
    for i in range(n_cat):
        for j in range(n_cat):
            val = matrix.iloc[i, j]
            if val > 0:
                sources.append(i)          # T1 节点
                targets.append(j + n_cat)  # T2 节点
                values.append(val)
    
    # 绘制
    fig = go.Figure(data=[go.Sankey(
        node = dict(
          pad = 15,
          thickness = 20,
          line = dict(color = "black", width = 0.5),
          label = nodes_label,
          color = "blue"
        ),
        link = dict(
          source = sources,
          target = targets,
          value = values,
          hoverinfo = 'all'
        )
    )])

    fig.update_layout(title_text=title, font_size=12)
    fig.show()
    
    # 同时保存为 HTML
    output_path = "land_use_sankey.html"
    fig.write_html(output_path)
    print(f"可视化结果已保存至: {os.path.abspath(output_path)}")

if __name__ == "__main__":
    print("--- 土地利用转移分析程序 ---")
    
    # 示例数据生成 (您可以替换为读取 CSV: df = pd.read_csv('data.csv'))
    # 假设有两列数据：'2010_landuse' 和 '2020_landuse'
    data = {
        'T1': ['耕地', '耕地', '林地', '草地', '建设用地', '耕地', '林地', '水域'],
        'T2': ['耕地', '建设用地', '林地', '林地', '建设用地', '林地', '林地', '水域']
    }
    df = pd.DataFrame(data)
    
    # 1. 计算矩阵
    matrix = calculate_transfer_matrix(df['T1'], df['T2'])
    
    print("\n[转移矩阵结果]:")
    print(matrix)
    
    # 2. 保存矩阵到 Excel
    matrix.to_excel("transfer_matrix.xlsx")
    print("\n矩阵已保存至: transfer_matrix.xlsx")
    
    # 3. 绘制桑基图
    plot_sankey(matrix)
