from PIL import Image, ImageDraw, ImageFont
import os

os.makedirs("test-data", exist_ok=True)

# 1. Reference Answer Sheet Image
ref_img = Image.new('RGB', (1000, 1400), color=(255, 255, 255))
draw = ImageDraw.Draw(ref_img)

text_ref = """
Big Data Analytics - Reference Answer Key

Q1: What is Hadoop? Explain its major components.
Hadoop is an open-source framework for distributed storage and processing of large datasets.
Major components: HDFS (storage), MapReduce (processing), YARN (resource management), and Common utilities.

Q2: Explain the architecture of HDFS.
HDFS uses a master-slave architecture. NameNode is the master managing metadata and block locations.
DataNodes are slaves storing actual data blocks with a default replication factor of 3 for fault tolerance.

Q3: Differentiate between MapReduce and Spark.
MapReduce processes data on disk in batches with high I/O overhead.
Spark processes data in-memory using Resilient Distributed Datasets (RDDs), providing up to 100x faster speed.
"""

# Draw reference text
y_pos = 50
for line in text_ref.strip().split('\n'):
    draw.text((50, y_pos), line, fill=(0, 0, 0))
    y_pos += 35

ref_img.save("test-data/reference-answer-sheet.png")
print("Generated test-data/reference-answer-sheet.png")

# 2. Student Answer Sheet Image
student_img = Image.new('RGB', (1000, 1400), color=(255, 255, 255))
draw_s = ImageDraw.Draw(student_img)

text_student = """
Student Submission - Roll No: STU001

Q1: What is Hadoop? Explain its major components.
Hadoop is an open source software framework for storing and processing big data across clusters of computers.
Components are HDFS for distributed storage, MapReduce for computation, and YARN for cluster management.

Q2: Explain the architecture of HDFS.
HDFS follows Master-Slave topology. NameNode stores file metadata and block positions.
DataNode stores the actual data blocks and reports to NameNode periodically.

Q3: Differentiate between MapReduce and Spark.
MapReduce works by writing intermediate data to disk, making it slower.
Apache Spark keeps data in-memory using RDDs, which makes execution significantly faster than MapReduce.
"""

y_pos = 50
for line in text_student.strip().split('\n'):
    draw_s.text((50, y_pos), line, fill=(0, 0, 0))
    y_pos += 35

student_img.save("test-data/student-answer-sheet.png")
print("Generated test-data/student-answer-sheet.png")
