import rasterio
import numpy as np
import pandas as pd
import plotly.graph_objects as go
import os

# ================= 配置区域 =================
# 1. 输入影像路径 (请替换为您本地的文件路径)
T1_RASTER = "landuse_2010.tif"
T2_RASTER = "landuse_2020.tif"

# 2. 地类编码映射 (根据您的遥感分类定义修改)
# 格式: {像素值: "类别名称"}
CLASS_MAPPING = {
    1: "耕地",
    2: "林地",
    3: "草地",
    4: "水域",
    5: "建设用地",
    6: "未利用地"
}

# 3. 无效值 (NoData) 定义
NODATA_VALUE = -9999 
# ===========================================

def analyze_rs_transfer(t1_path, t2_path, mapping, nodata):
    print(f"正在读取影像...")
    
    with rasterio.open(t1_path) as src1, rasterio.open(t2_path) as src2:
        # 检查两期影像的分辨率和范围是否一致
        if src1.shape != src2.shape:
            print("警告: 两期影像行列数不一致！程序将尝试以第一期为准进行裁剪。")
        
        # 读取第一波段数据
        data1 = src1.read(1).flatten()
        data2 = src2.read(1).flatten()
        
        # 获取元数据中的 NoData (如果脚本配置中没写，则尝试从文件读取)
        file_nodata = src1.nodata if src1.nodata is not None else nodata
        
        print(f"总像素数: {len(data1):,}")

        # 过滤无效值 (只保留两期都有值的像素)
        mask = (data1 != file_nodata) & (data2 != file_nodata)
        t1_valid = data1[mask]
        t2_valid = data2[mask]
        
        print(f"有效分析像素数: {len(t1_valid):,}")

        # 将像素编码转换为类别名称
        t1_names = [mapping.get(v, f"未知({v})") for v in t1_valid]
        t2_names = [mapping.get(v, f"未知({v})") for v in t2_valid]

        # 计算转移矩阵
        print("正在计算转移矩阵...")
        categories = sorted(list(set(t1_names) | set(t2_names)))
        matrix = pd.crosstab(
            pd.Series(t1_names, name='初期(T1)'), 
            pd.Series(t2_names, name='末期(T2)'),
            dropna=False
        )
        matrix = matrix.reindex(index=categories, columns=categories, fill_value=0)
        
        return matrix

def plot_sankey(matrix, output_html="rs_sankey.html"):
    categories = matrix.index.tolist()
    n = len(categories)
    
    labels = [f"{c} (T1)" for c in categories] + [f"{c} (T2)" for c in categories]
    
    sources, targets, values = [], [], []
    for i in range(n):
        for j in range(n):
            val = matrix.iloc[i, j]
            if val > 0:
                sources.append(i)
                targets.append(j + n)
                values.append(float(val))

    fig = go.Figure(data=[go.Sankey(
        node=dict(pad=15, thickness=20, label=labels, color="royalblue"),
        link=dict(source=sources, target=targets, value=values)
    )])

    fig.update_layout(title_text="遥感影像土地利用转移分析", font_size=12)
    fig.write_html(output_html)
    print(f"桑基图已生成: {os.path.abspath(output_html)}")
    fig.show()

if __name__ == "__main__":
    # 检查文件是否存在
    if not os.path.exists(T1_RASTER) or not os.path.exists(T2_RASTER):
        print(f"错误: 找不到影像文件。请确保 {T1_RASTER} 和 {T2_RASTER} 在当前目录下。")
    else:
        # 执行分析
        result_matrix = analyze_rs_transfer(T1_RASTER, T2_RASTER, CLASS_MAPPING, NODATA_VALUE)
        
        # 打印并保存结果
        print("\n--- 转移矩阵 (单位: 像素数) ---")
        print(result_matrix)
        
        result_matrix.to_csv("transfer_matrix_results.csv", encoding='utf-8-sig')
        print("\n矩阵结果已保存至: transfer_matrix_results.csv")
        
        # 绘图
        plot_sankey(result_matrix)
